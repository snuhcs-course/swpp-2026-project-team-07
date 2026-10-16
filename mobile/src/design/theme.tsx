// AI-generated/modified with OpenAI Codex, Iteration 2 (2026-10-15).
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { readStored, writeStored } from '../services/storage';
import { DARK_PALETTE, LIGHT_PALETTE, type Palette } from './tokens';

export type ThemeMode = 'dark' | 'light';
type Theme = { mode: ThemeMode; c: Palette; toggle: () => void };
const ThemeContext = createContext<Theme>({ mode: 'dark', c: DARK_PALETTE, toggle: () => {} });
function initialMode(): ThemeMode {
  try { return readStored<ThemeMode>('settings.theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

// Build both style sheets once. Consumers subscribe via useTheme(), while the
// proxy preserves their named style references and switches palette on render.
let activeMode: ThemeMode = 'dark';
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const stored = initialMode();
    activeMode = stored;
    return stored;
  });
  const toggle = useCallback(() => setMode(current => {
    const next = current === 'dark' ? 'light' : 'dark';
    activeMode = next;
    try { writeStored('settings.theme', next); } catch { /* Retain this session's choice. */ }
    return next;
  }), []);
  return <ThemeContext.Provider value={{ mode, c: mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE, toggle }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }

type NamedStyles<T> = { [K in keyof T]: ViewStyle | TextStyle | ImageStyle };
const normalized = (value: string) => value.replace(/\s+/g, '').toLowerCase();
const surfaceByAlpha: Record<string, keyof Palette> = { '0.04': 'surface04', '0.06': 'surface06', '0.08': 'surface08', '0.1': 'surface10', '0.12': 'surface12' };
const borderByAlpha: Record<string, keyof Palette> = { '0.06': 'border06', '0.08': 'border08', '0.1': 'hair', '0.12': 'border12', '0.14': 'border14', '0.3': 'border30', '0.5': 'border50', '0.55': 'border55' };
const inkByAlpha: Record<string, keyof Palette> = { '0.05': 'ink05', '0.08': 'ink08', '0.14': 'ink14', '0.16': 'ink16', '0.18': 'ink18', '0.2': 'ink20', '0.28': 'ink28', '0.4': 'ink40', '0.45': 'ink45', '0.55': 'ink55', '0.7': 'ink70' };
function lightValue(value: string, property: string, name: string): string {
  // Text and glyphs on saturated, unchanged controls remain white.
  if (['stop', 'count', 'revealText', 'who'].includes(name)) return value;
  if (value === '#FFFFFF') return LIGHT_PALETTE.strong;
  if (value === '#FFD866') return property === 'backgroundColor' ? value : LIGHT_PALETTE.gold;
  if (value === '#FFE08A') return LIGHT_PALETTE.goldText;
  if (value === '#CBB8FF') return LIGHT_PALETTE.violetText;
  if (value === '#FFC266') return LIGHT_PALETTE.warn;
  if (value === '#FFB7A7') return LIGHT_PALETTE.bad;
  if (value === '#100E14') return LIGHT_PALETTE.dialog;
  if (value === 'rgba(8,7,12,0.72)') return LIGHT_PALETTE.scrim;
  if (value === DARK_PALETTE.meta) return LIGHT_PALETTE.meta;
  if (name === 'card' && property === 'backgroundColor' && normalized(value) === 'rgba(255,255,255,0.05)') return LIGHT_PALETTE.surface06;
  if (name === 'txRule' && property === 'backgroundColor') return LIGHT_PALETTE.hair;
  if (property === 'boxShadow' && value.includes('rgba(0, 0, 0, 0.55)')) return value.replace('rgba(0, 0, 0, 0.55)', LIGHT_PALETTE.dialogShadow);
  const alpha = normalized(value).match(/^rgba\(255,255,255,([\d.]+)\)$/)?.[1];
  if (alpha) {
    if (property.toLowerCase().includes('border')) return LIGHT_PALETTE[borderByAlpha[alpha]] ?? value;
    if (property === 'backgroundColor') return LIGHT_PALETTE[surfaceByAlpha[alpha] ?? inkByAlpha[alpha]] ?? value;
    if (property === 'color') return `rgba(21,23,30,${alpha})`;
  }
  for (const key of Object.keys(DARK_PALETTE) as (keyof Palette)[]) {
    if (value !== DARK_PALETTE[key]) continue;
    if (alpha && property.toLowerCase().includes('border')) return LIGHT_PALETTE[borderByAlpha[alpha]] ?? value;
    return LIGHT_PALETTE[key];
  }
  return value;
}

export function createThemedStyles<T extends NamedStyles<T>>(styles: T): T {
  const dark = StyleSheet.create(styles);
  const lightStyles = {} as T;
  for (const name of Object.keys(styles) as (keyof T)[]) {
    const original = styles[name] as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    for (const [property, value] of Object.entries(original)) updated[property] = typeof value === 'string' ? lightValue(value, property, String(name)) : value;
    lightStyles[name] = updated as unknown as T[keyof T];
  }
  const light = StyleSheet.create(lightStyles);
  return new Proxy(dark, { get(target, key, receiver) { return Reflect.get(activeMode === 'light' ? light : target, key, receiver); } }) as T;
}
