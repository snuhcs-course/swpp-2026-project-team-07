// One persisted choice serves the interface, native accessibility and AI result displays.
import { useSyncExternalStore } from 'react';
import { readStored, writeStored } from '../services/storage';
import { koreanText } from './koreanText';
import { STORE_MODE } from '../services/apiConfig';
import { storeWording } from './storeWording';

export type AppLanguage = 'en' | 'ko';
const preferenceKey = 'settings.languagePreference';
const listeners = new Set<() => void>();
let selected: AppLanguage | undefined;

export function getAppLanguage(): AppLanguage {
  if (selected === undefined) {
    try { selected = readStored<string>(preferenceKey) === 'ko' ? 'ko' : 'en'; }
    catch { selected = 'en'; }
  }
  return selected;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useAppLanguage(): AppLanguage {
  return useSyncExternalStore(subscribe, getAppLanguage, getAppLanguage);
}

/** A storage failure still applies the choice for the current session. */
export function setAppLanguage(language: AppLanguage): boolean {
  let saved = true;
  try { writeStored(preferenceKey, language); } catch { saved = false; }
  if (selected !== language) {
    selected = language;
    listeners.forEach(listener => listener());
  }
  return saved;
}

const original: typeof koreanText = <T>(text: T) => text;
function storeLanguage(translate: typeof koreanText): typeof koreanText {
  function display(text: string): string;
  function display(text: string | undefined): string | undefined;
  function display(text: string | undefined) { return typeof text === 'string' ? translate(storeWording(text)) : undefined; }
  return display;
}
const publicEnglish = storeLanguage(original), publicKorean = storeLanguage(koreanText);
export function useUiText(): typeof koreanText {
  const ko = useAppLanguage() === 'ko';
  return STORE_MODE ? (ko ? publicKorean : publicEnglish) : (ko ? koreanText : original);
}
