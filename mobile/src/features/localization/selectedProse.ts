// Use the screen projections on the selected, saved work. No slide text, audio or transcript enters a request.
import { readStored } from '../../services/storage';
import { translatedAnswer, translatedFinding, translatedProfile, translatedScore, translatedV3, translatedV3Cards } from './generatedProse';
import { rubricWording } from './rubricWording';
import type { Kind, PreparedResource } from './translationCache';
import { feedbackTargets } from '../feedback/useRunFeedbackV3';
import { readSavedRun } from '../feedback/feedbackRunClient';
import { selectedSlideFeedback } from '../feedback/selectedSlideFeedback';
import { selectedPresentationScores } from '../feedback/selectedPresentationScores';
import { readFeedback } from '../feedback/storage';
import { captureFeedback, readCapture } from '../recording/incrementalState';
import { readRequirements } from '../presentations/requirementsStore';
import { readProfiles } from '../presentations/slideProfiles';
import type { DeckModel } from '../presentations/useDeckModel';
import { answerKey, readQaHistory, savedForSelectedRun, type QaSet } from '../qa/store';
import { parseQaState, qaActive, qaAnchor, qaScope, qaUsable, type QaState } from '../qa/state';

function collection() {
  const resources = new Map<string, PreparedResource>();
  const waiting = new Set<string>();
  function scope(kind: Kind, id: string, revision?: string, upcoming = false) {
    const key = JSON.stringify([kind, id, revision]);
    if (upcoming) waiting.add(key);
    let row = resources.get(key);
    if (!row) { row = { kind, resource_id: id, revision, fields: {} }; resources.set(key, row); }
    const fields = row.fields;
    return (path: string, value: string) => {
      if (typeof value === 'string' && /\p{Letter}/u.test(value) && value.length <= 4000 &&
          !rubricWording(kind, path, value, 'ko')) fields[path] = value;
      return value;
    };
  }
  return { scope, all: () => Array.from(resources).filter(([key, r]) => waiting.has(key) || Object.keys(r.fields).length).map(([, r]) => r) };
}

export function prepareSavedQa(set: Pick<QaSet, 'runId' | 'questions' | 'jobId' | 'answers'>) {
  const c = collection();
  if (!set.runId || !Array.isArray(set.questions) || !set.questions.length) return [];
  const job = set.jobId;
  const field = c.scope(job ? 'questions' : 'legacy_qa', job ? String(job) : set.runId);
  set.questions.forEach((q, i) => {
    if (!q || typeof q.question !== 'string' || typeof q.follow_up !== 'string') return;
    field('questions.' + i + '.question', q.question);
    field('questions.' + i + '.follow_up', q.follow_up);
    for (const part of [0, 1] as const) {
      const a = set.answers?.[answerKey(i, part)];
      if (!a || a.questionId && a.questionId !== q.id || a.questionJobId && a.questionJobId !== job) continue;
      const durable = !!job && !!a.id;
      if (a.status !== 'done' || !a.result) {
        if (durable && a.status === 'judging') c.scope('answer', a.id!, undefined, true);
        continue;
      }
      translatedAnswer(a.result, c.scope(durable ? 'answer' : 'legacy_qa', durable ? a.id! : set.runId), i, part);
    }
  });
  return c.all();
}

export function selectedProse(model: DeckModel, api: string): PreparedResource[] {
  const c = collection(), deck = model.deck.id, run = model.state.run;
  const mapped = readStored<string>('server-deck:' + api + ':' + deck);
  const profiles = mapped ? readProfiles(api, mapped, model.n) : null;
  if (profiles?.description_set_id) {
    const upcoming = !profiles.descriptions && ['queued','preparing','submitted','normalizing','waiting_quota'].includes(profiles.state);
    const field = c.scope('profiles', profiles.description_set_id, String(profiles.description_revision + (upcoming ? 1 : 0)), upcoming);
    profiles.descriptions?.slides.forEach(slide => translatedProfile(slide, field));
  }
  const targets = feedbackTargets(model, api);
  for (const t of targets) {
    const capture = readCapture(t.id), streaming = capture?.api === api ? capture : null;
    const saved = captureFeedback(streaming, readSavedRun(api, t.id, t.contextId));
    if (saved?.runId || streaming?.remote?.stopped) {
      const field = c.scope('feedback', saved?.runId || t.id, undefined,
        saved ? ['queued','running'].includes(saved.status) : !!streaming?.remote?.stopped);
      saved?.slides.forEach(slide => {
        if (run?.parts[slide.slide_index]?.attemptId === t.id && (slide.status === 'scored' || slide.status === 'insufficient_evidence')) {
          translatedV3(slide, field, 'slides.' + slide.slide_index);
        }
      });
      if (saved?.whole && targets.length === 1) translatedV3Cards(saved.whole, field, 'whole');
    }
    const coaching = readFeedback(api, t.id)?.result;
    if (coaching) {
      const field = c.scope('coaching', t.id, String(coaching.feedback_revision));
      coaching.suggestions.slice(0, 3).forEach((f, i) => translatedFinding(f, field, 'suggestions.' + i));
    }
  }
  const legacy = selectedSlideFeedback(model, api);
  for (const item of legacy.items) {
    const id = run?.parts[item.slide]?.attemptId;
    if (!id || !item.findings.length) continue;
    const field = c.scope('slide_review', id);
    item.findings.forEach((f, i) => translatedFinding(f, field, 'slides.' + item.slide + '.findings.' + i));
  }
  const scores = selectedPresentationScores(model, api);
  for (const item of scores.items) if (item.result && item.target) {
    translatedScore(item.result, c.scope('score', item.target.id, String(item.state?.feedback_revision ?? 0)), 'score.slides.' + item.slide);
  }
  const overall = scores.overall;
  if (overall.result && overall.target) translatedScore(overall.result,
    c.scope('score', overall.target.id, String(overall.state?.feedback_revision ?? 0)), 'score');

  const result = c.all();
  if (run) {
    const history = readQaHistory(api, deck), requirements = readRequirements(deck, api);
    const scope = qaScope(run, requirements.contextId), anchor = qaAnchor(scope);
    const raw = anchor && readStored<unknown>('qa-state:v2:' + JSON.stringify([api, anchor, scope]));
    let state: QaState | null = null;
    if (anchor && raw) {
      try { state = parseQaState(raw, anchor, scope); }
      catch { /* A partial phone row cannot authenticate this question set. */ }
    }
    if (qaUsable(state)) {
      const saved = state!.result!, stored = history.find(s => s.jobId === saved.job_id);
      result.push(...prepareSavedQa({ runId: run.id, jobId: saved.job_id, questions: saved.questions, answers: stored?.answers ?? {} }));
    } else if (!qaActive(state)) {
      const selected = savedForSelectedRun(history, run.id, scope, requirements.audience);
      if (selected) result.push(...prepareSavedQa(selected));
    }
  }
  return result;
}
