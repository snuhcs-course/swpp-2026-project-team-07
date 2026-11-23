import { useEffect, useSyncExternalStore } from 'react';
import { useAppLanguage } from '../../design/language';
import { API_URL } from '../../services/apiConfig';
import { backendFetch } from '../../services/backendFetch';
import { readStored, writeStored } from '../../services/storage';
import { isDisplayWording } from './displayWording';
import { rubricWording } from './rubricWording';
import { createTranslationCache, sourceLanguage, splitRequest, type Fields, type Kind, type Request, type Resource } from './translationCache';

export const displayTranslations = createTranslationCache({ api: API_URL, read: readStored, write: writeStored, fetch: backendFetch });
export type DisplayField = (path: string, source: string, languageHint?: string | null) => string;
export type DisplayScope = (kind: Kind, id: string, revision?: string, originalLanguage?: string | null) => DisplayField;

/** A prepared field is selected synchronously on the same render as the flag. */
export function useDisplayTranslation<T>(active: boolean, project: (scope: DisplayScope) => T) {
  const language = useAppLanguage();
  useSyncExternalStore(displayTranslations.subscribe, displayTranslations.version);
  const groups = new Map<string, { resource: Resource; fields: Fields }>();
  const missing = new Set<string>();
  const value = project((kind, id, revision, originalLanguage) => {
    const resource: Resource = { kind, resource_id: id, language, ...(revision ? { revision } : {}) };
    const key = JSON.stringify(resource);
    return (path, source, hint = originalLanguage) => {
      const rubric = rubricWording(kind, path, source, language);
      if (rubric !== null) return rubric;
      if (!/\p{Letter}/u.test(source) ||
          (sourceLanguage(source, hint) === language && isDisplayWording(resource, path, source, source))) return source;
      const text = displayTranslations.get(resource, path, source);
      if (text !== null) return text;
      missing.add(path);
      if (id) {
        let group = groups.get(key);
        if (!group) { group = { resource, fields: {} }; groups.set(key, group); }
        group.fields[path] = source;
      }
      // Older results may first be opened offline. Keep their measurements and
      // evidence usable while the missing coaching is synchronized independently.
      const unavailable = displayTranslations.unavailable(resource, path, source);
      if (kind === 'profiles' && path.endsWith('.text')) {
        if (unavailable) return language === 'ko' ? '이 도움말의 한국어 버전을 불러올 수 없어요.' : 'This cue is unavailable in English.';
        return language === 'ko' ? '한국어 도움말 동기화 대기 중' : 'Waiting for English cues';
      }
      if (/(?:^|\.)(?:question|follow_up)$/.test(path)) {
        if (unavailable) return language === 'ko' ? '이 질문의 한국어 버전을 불러올 수 없어요.' : 'This question is unavailable in English.';
        return language === 'ko' ? '한국어 질문 동기화 대기 중' : 'Waiting for the English question';
      }
      if (/(?:^|\.)(?:headline|title|problem|summary|observation|did)$/.test(path)) {
        if (unavailable) return language === 'ko' ? '이 피드백의 한국어 버전을 불러올 수 없어요.' : 'This feedback is unavailable in English.';
        return language === 'ko' ? '한국어 피드백 동기화 대기 중' : 'Waiting for English feedback';
      }
      return '…';
    };
  });
  const requests = active ? [...groups.values()].flatMap(({ resource, fields }) => splitRequest(resource, fields)) : [];
  const signature = JSON.stringify(requests);
  useEffect(() => {
    const submitted = JSON.parse(signature) as Request[];
    if (submitted.length) return displayTranslations.retain(submitted);
  }, [signature]);
  return { value, missing, language };
}
