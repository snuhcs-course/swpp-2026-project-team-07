// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: saved Audience Q&A per presentation (questions, answers, reviews).
import { readStored, writeStored } from '../../services/storage';
import { API_URL } from '../../services/api';
import { normalizeApi } from '../transcription/analysisStorage';
import type { QaQuestion, QaResult } from './client';

export type StoredAnswer = { audioUri: string; durationMs: number; status: 'judging' | 'done' | 'error'; result?: QaResult; error?: string; at: string };
export type QaSet = { runId: string; audience: string; questions: QaQuestion[]; answers: Record<string, StoredAnswer>; createdAt: string };

const KEY = (deckId: string) => `qa:v1:${deckId}`;
export function readQa(deckId: string): QaSet | null {
  const v = readStored<QaSet>(KEY(deckId));
  return v && Array.isArray(v.questions) && v.answers && typeof v.answers === 'object' ? v : null;
}
export function saveQa(deckId: string, set: QaSet) { writeStored(KEY(deckId), set); }
export const answerKey = (i: number, part: 0 | 1) => i + '-' + part;

const CONSENT = () => `qa-consent:v1:${normalizeApi(API_URL)}`;
export const hasQaConsent = () => readStored<boolean>(CONSENT()) === true;
export const saveQaConsent = () => writeStored(CONSENT(), true);
