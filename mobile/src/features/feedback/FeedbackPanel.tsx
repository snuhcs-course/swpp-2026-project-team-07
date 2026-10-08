import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { DescriptionFact, ReviewAttempt } from '../../contracts';
import { Action, Card, styles } from '../../ui/components';
import { feedbackSeekTarget } from './validation';
import { useFeedbackReview } from './useFeedbackReview';

const origin = (value?: string | null) => value === 'generated' ? 'Generated' : value === 'edited' ? 'Edited set' : 'Origin unavailable';
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const states: Record<string, string> = { absent: 'Ready to generate', disabled: 'Generation disabled', unavailable: 'Generation unavailable',
  waiting_descriptions: 'Describing slides', queued: 'Queued', preparing: 'Preparing coaching', submitted: 'Preparing coaching',
  normalizing: 'Preparing coaching', waiting_quota: 'Waiting for quota', failed: 'Failed', needs_confirmation: 'Needs confirmation', stale: 'Stale', completed: 'Completed' };
const errors: Record<string, string> = { no_speech: 'No speech is available for suggestions.', missing_transcript: 'Analyze the saved recording before generating feedback.',
  unsupported_feedback: 'The latest output contained no supported cards. It failed validation.',
  description_dependency_failed: 'Slide descriptions need attention before coaching can continue.',
  descriptions_changed: 'Descriptions changed. Regenerate explicitly to use the saved transcript with the edited facts.',
  disabled: 'Feedback generation is disabled on this server.', source_changed: 'The saved source changed. Refresh to review the available evidence.' };

export function FeedbackPanel({ id, apiUrl, review, pages, canSeek, onSeek }: {
  id: string; apiUrl: string; review: ReviewAttempt; pages?: number; canSeek: boolean; onSeek: (ms: number) => void;
}) {
  const feedback = useFeedbackReview(id, apiUrl, review);
  const f = feedback.feedback, d = feedback.descriptions;
  const [expanded, setExpanded] = useState<number | null>(null), [quotes, setQuotes] = useState<number | null>(null);
  const selected = feedback.prompt?.intent.selection || f?.selection || f?.provenance;
  const dependency = f?.dependency;
  const stoppedDependency = dependency?.retry_action === 'generate_descriptions' && !f?.stale;
  const canGenerate = !!f && f.availability.state === 'available' && !feedback.busy && !feedback.prompt && !feedback.draft && !stoppedDependency &&
    (f.feedback_revision === 0 || f.retry_available);
  const descriptionStage = dependency?.state === 'preparing' ? 'Preparing slides' : dependency?.state === 'submitted' ? 'Describing slides' : dependency?.state === 'normalizing' ? 'Saving descriptions' : states[dependency?.state || ''];
  const state = dependency && !f?.stale ? `Describing slides · ${descriptionStage || 'Unavailable'}` : `${states[f?.state || 'unavailable']}${f?.stale && f.requires_confirmation ? ' · Needs confirmation' : ''}`;
  const draftSlide = feedback.draft?.descriptions.slides.find(s => s.slide_index === feedback.draft?.slide);
  function changeFact(kind: 'summary' | 'key_ideas' | 'visual_facts', index: number, next: DescriptionFact) {
    if (!feedback.draft) return;
    feedback.change({ slides: feedback.draft.descriptions.slides.map(slide => slide.slide_index !== feedback.draft!.slide ? slide :
      { ...slide, [kind]: kind === 'summary' ? next : slide[kind].map((fact, i) => i === index ? next : fact) }) });
  }
  function editor(label: string, fact: DescriptionFact, kind: 'summary' | 'key_ideas' | 'visual_facts', index = 0) {
    return <View key={`${kind}:${index}`} style={{ gap: 8 }}>
      <Text style={styles.body}>{label} · 400 characters maximum</Text>
      <TextInput accessibilityLabel={`${label} text`} style={styles.input} multiline editable={!feedback.busy} value={fact.text}
        onChangeText={text => changeFact(kind, index, { ...fact, text })} />
      <Action label={`${label}: ${fact.uncertain ? 'uncertain' : 'certain'} — toggle`} secondary disabled={feedback.busy}
        onPress={() => changeFact(kind, index, { ...fact, uncertain: !fact.uncertain, uncertainty: fact.uncertain ? '' : fact.uncertainty })} />
      {fact.uncertain && <TextInput accessibilityLabel={`${label} uncertainty explanation`} style={styles.input} multiline editable={!feedback.busy}
        value={fact.uncertainty} onChangeText={uncertainty => changeFact(kind, index, { ...fact, uncertainty })} />}
    </View>;
  }
  return <Card>
    <Text style={styles.heading}>AI suggestions — check the evidence</Text>
    <Text style={styles.body}>Suggestions may be wrong. A linked source does not establish factual truth or perfect transcription.</Text>
    <Text style={styles.body}>{selected ? `${selected.provider === 'gemini' ? 'Gemini' : 'OpenAI'} · ${selected.model}` : 'Provider selection unavailable — Refresh before generation.'}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>{state}</Text>
    <Action label="Refresh feedback" disabled={feedback.busy} onPress={() => void feedback.refresh()} secondary />
    {(f?.feedback_revision === 0 || f?.retry_available) && <Action label={f?.feedback_revision ? (f.stale ? 'Regenerate feedback' : 'Retry feedback') : 'Generate feedback'} disabled={!canGenerate} onPress={feedback.generate} />}
    {stoppedDependency && <Action label="Retry slide descriptions" disabled={feedback.busy || !!feedback.prompt || !!feedback.draft || !dependency.retry_available || !d?.selection}
      onPress={feedback.retryDescriptions} />}
    {!!feedback.draft && <Text style={styles.body}>Save or Cancel your description draft before generating feedback.</Text>}
    {feedback.busy && <Text style={styles.body}>Checking current revisions…</Text>}
    {!!(f?.retry_at || dependency?.retry_at) && <Text style={styles.body}>Retry after {new Date(dependency?.retry_at || f!.retry_at!).toLocaleString()}. Refresh to check.</Text>}
    {!!f?.error && <Text accessibilityRole="alert" style={styles.body}>{Object.prototype.hasOwnProperty.call(errors, f.error.code) ? errors[f.error.code] : 'Feedback could not be completed. Refresh for safe recovery options.'}</Text>}
    {!!feedback.notice && <Text accessibilityRole="alert" style={styles.body}>{feedback.notice}</Text>}
    {feedback.prompt && <View style={{ gap: 12 }}>
      <Text style={styles.body}>{feedback.prompt.kind === 'disclosure'
        ? `Feedback sends slide images/text, descriptions, the saved transcript and optional audience context through this server to ${feedback.prompt.intent.selection.provider === 'gemini' ? 'Gemini' : 'OpenAI'} (${feedback.prompt.intent.selection.model}). Feedback does not send audio. Generation may incur provider charges. Continue allows this provider for future feedback on this API address and device. Cancel sends no generation request.`
        : 'A previous submitted request may already have been charged. Another request may incur another charge. Continue only if you accept this uncertainty; Cancel makes no generation request.'}</Text>
      <Action label="Continue feedback" onPress={feedback.continuePrompt} />
      <Action label="Cancel feedback" onPress={feedback.cancelPrompt} secondary />
    </View>}
    {f?.last_output?.status === 'all_invalid' && <Text style={styles.body}>Latest generation failed: all returned cards were unsupported. Earlier suggestions, if shown, are stale.</Text>}
    {f?.result && <>
      {f.result.stale && <Text style={styles.body}>Stale suggestions · evidence playback is disabled. Regeneration is explicit.</Text>}
      {f.result.status === 'partial' && <Text style={styles.body}>Partial feedback · {f.result.accepted_count} supported, {f.result.discarded_count} discarded.</Text>}
      {f.result.status === 'empty' && <Text style={styles.body}>No supported suggestions.</Text>}
      {f.result.suggestions.slice(0, 3).map((card, index) => {
        const target = pages && canSeek ? feedbackSeekTarget(f, index, review, pages) : null;
        return <View key={`${f.result!.feedback_revision}:${index}`} style={{ gap: 10 }}>
          <Text style={styles.label}>{card.category}</Text>
          <Text style={styles.body}>Slide {card.slide_index + 1} · Visit {card.visit_id + 1} · {time(card.start_ms)}–{time(card.end_ms)}</Text>
          <Text style={styles.body}>{card.observation}</Text><Text style={styles.body}>{card.suggestion}</Text>
          <Action label={`Review evidence ${index + 1}`} disabled={!target} onPress={() => { if (target) onSeek(target.start_ms); }} secondary />
          <Action label={`${quotes === index ? 'Hide' : 'Show'} supporting quotes ${index + 1}`} expanded={quotes === index}
            onPress={() => setQuotes(quotes === index ? null : index)} secondary />
          {quotes === index && <>
            <Text style={styles.body}>Slide description · {origin(f.result!.description_origin)} (not necessarily verbatim PDF text)</Text>
            <Text style={styles.body}>{card.slide_quote}</Text>
            <Text style={styles.body}>Transcript excerpt</Text><Text style={styles.body}>{card.speech_quote}</Text>
          </>}
        </View>;
      })}
    </>}
    <Text style={styles.heading}>Slide descriptions</Text>
    <Text style={styles.body}>Read and edit saved descriptions without a provider request. Original slide and source identities are preserved.</Text>
    {!d?.descriptions && <Text style={styles.body}>No saved descriptions available.</Text>}
    {d?.stale && <Text style={styles.body}>These saved descriptions differ from the current default or source. Saved feedback retains its original selection.</Text>}
    {d?.descriptions?.slides.map(slide => <View key={slide.source_id} style={{ gap: 10 }}>
      <Action label={`${expanded === slide.slide_index ? 'Hide' : 'Show'} slide ${slide.slide_index + 1} description`} secondary expanded={expanded === slide.slide_index}
        onPress={() => setExpanded(expanded === slide.slide_index ? null : slide.slide_index)} />
      {expanded === slide.slide_index && <>
        <Text style={styles.body}>Slide {slide.slide_index + 1} · {origin(d.provenance?.origin)} · revision {d.description_revision}</Text>
        {[['Summary', [slide.summary]], ['Key ideas', slide.key_ideas], ['Visual facts', slide.visual_facts]].map(([label, facts]) => <View key={label as string}>
          <Text style={styles.body}>{label as string}</Text>
          {(facts as DescriptionFact[]).map((fact, i) => <Text key={i} style={styles.body}>{fact.text}{fact.uncertain ? ` · Uncertain: ${fact.uncertainty}` : ''}</Text>)}
        </View>)}
        <Action label={`Edit slide ${slide.slide_index + 1} description`} disabled={feedback.busy || !!feedback.prompt || !!feedback.draft} secondary onPress={() => feedback.edit(slide.slide_index)} />
      </>}
    </View>)}
    {feedback.draft && draftSlide && <View style={{ gap: 12 }}>
      <Text style={styles.heading}>Edit slide {draftSlide.slide_index + 1} description</Text>
      <Text style={styles.body}>Unsaved draft from revision {feedback.draft.revision}. Other slides remain unchanged.</Text>
      {editor('Summary', draftSlide.summary, 'summary')}
      {draftSlide.key_ideas.map((fact, i) => editor(`Key idea ${i + 1}`, fact, 'key_ideas', i))}
      {draftSlide.visual_facts.map((fact, i) => editor(`Visual fact ${i + 1}`, fact, 'visual_facts', i))}
      <Action label="Save description" disabled={feedback.busy || feedback.conflict} onPress={() => void feedback.save()} />
      {feedback.conflict && <Action label="Reload descriptions" disabled={feedback.busy} onPress={() => void feedback.reloadDraft()} secondary />}
      <Action label="Cancel description edit" disabled={feedback.busy} onPress={feedback.cancelEdit} secondary />
    </View>}
  </Card>;
}
