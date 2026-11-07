// Generated from outloud-ui-spec/tokens.json (redesign v2, November 2026).
import { Easing } from 'react-native-reanimated';
import type { HueName } from '../domain/hues';

export const DARK = '#121111';
const dark = {
  bg: '#121111', surface: '#1B1A1A', raised: '#242222', dialog: '#1E1C1C', line: '#2E2B2B',
  hair: 'rgba(255,255,255,0.10)', text: '#F9F9F9', text2: '#E8E5E5', muted: '#A8A3A3',
  muted2: '#8F8A8A', track: '#2A2727', dotOff: '#4A4545', accent: '#D485FC', onAccent: '#121111',
  accentSoft: 'rgba(212,133,252,0.16)', record: '#E0414B', scrim: 'rgba(0,0,0,0.62)',
  gradeOnFill:'#121111',
  glass: 'rgba(0,0,0,0.45)', strong: '#3FD9A4', good: '#3FD9A4', warn: '#FF9A3D', warnAlt: '#FF9A3D',
  bad: '#FF6B5E', badAlt: '#FF6B5E', gold: '#FFD866', goldText: '#FFD866', yellow: '#FFD866',
  info: '#D485FC', violetText: '#D485FC', coralText: '#FF6B5E',
  surface04: 'rgba(255,255,255,0.04)', surface06: 'rgba(255,255,255,0.06)', surface08: 'rgba(255,255,255,0.08)',
  surface10: 'rgba(255,255,255,0.10)', surface12: 'rgba(255,255,255,0.12)', border06: 'rgba(255,255,255,0.06)',
  border08: 'rgba(255,255,255,0.08)', border12: 'rgba(255,255,255,0.12)', border14: 'rgba(255,255,255,0.14)',
  border30: 'rgba(255,255,255,0.30)', border50: 'rgba(255,255,255,0.50)', border55: 'rgba(255,255,255,0.55)',
  ink05: 'rgba(255,255,255,0.05)', ink08: 'rgba(255,255,255,0.08)', ink14: 'rgba(255,255,255,0.14)',
  ink16: 'rgba(255,255,255,0.16)', ink18: 'rgba(255,255,255,0.18)', ink20: 'rgba(255,255,255,0.20)',
  ink28: 'rgba(255,255,255,0.28)', ink40: 'rgba(255,255,255,0.40)', ink45: 'rgba(255,255,255,0.45)',
  ink55: 'rgba(255,255,255,0.55)', ink70: 'rgba(255,255,255,0.70)',
  meta: 'rgba(249,249,249,0.62)', toast: '#1E1C1C', toastBorder: '#2E2B2B', dialogShadow: 'rgba(0,0,0,0.45)',
  pickerScrim: 'rgba(0,0,0,0.62)', hud: 'rgba(0,0,0,0.45)', rowDrag: '#1B1A1A', ground: 'rgba(0,0,0,0.32)',
  markerGlow: 'rgba(255,255,255,0.5)', titleShadow: 'rgba(0,0,0,0.18)',
  body: '#E8E5E5', body2: '#E8E5E5', body3: '#E8E5E5', secondary: '#A8A3A3', tertiary: '#8F8A8A', dim: '#8F8A8A',
} as const;
const light = {
  bg: '#F9F9F9', surface: '#FFFFFF', raised: '#F1EFEF', dialog: '#FFFFFF', line: 'rgba(18,17,17,0.08)',
  hair: 'rgba(18,17,17,0.10)', text: '#121111', text2: '#2B2828', muted: '#5E5959', muted2: '#767171',
  track: 'rgba(18,17,17,0.09)', dotOff: 'rgba(18,17,17,0.20)', accent: '#9440C8', onAccent: '#FFFFFF',
  accentSoft: 'rgba(148,64,200,0.12)', record: '#E0414B', scrim: 'rgba(18,17,17,0.30)', glass: 'rgba(0,0,0,0.45)',
  gradeOnFill:'#121111',
  strong: '#08875C', good: '#08875C', warn: '#B35400', warnAlt: '#B35400', bad: '#C2392C', badAlt: '#C2392C',
  gold: '#B8860B', goldText: '#946300', yellow: '#FFD866', info: '#9440C8', violetText: '#9440C8', coralText: '#C2392C',
  surface04: 'rgba(18,17,17,0.04)', surface06: 'rgba(18,17,17,0.06)', surface08: 'rgba(18,17,17,0.08)',
  surface10: 'rgba(18,17,17,0.10)', surface12: 'rgba(18,17,17,0.12)', border06: 'rgba(18,17,17,0.06)',
  border08: 'rgba(18,17,17,0.08)', border12: 'rgba(18,17,17,0.12)', border14: 'rgba(18,17,17,0.14)',
  border30: 'rgba(18,17,17,0.30)', border50: 'rgba(18,17,17,0.50)', border55: 'rgba(18,17,17,0.55)',
  ink05: 'rgba(18,17,17,0.05)', ink08: 'rgba(18,17,17,0.08)', ink14: 'rgba(18,17,17,0.14)',
  ink16: 'rgba(18,17,17,0.16)', ink18: 'rgba(18,17,17,0.18)', ink20: 'rgba(18,17,17,0.20)',
  ink28: 'rgba(18,17,17,0.28)', ink40: 'rgba(18,17,17,0.40)', ink45: 'rgba(18,17,17,0.45)',
  ink55: 'rgba(18,17,17,0.55)', ink70: 'rgba(18,17,17,0.70)',
  meta: 'rgba(18,17,17,0.62)', toast: '#FFFFFF', toastBorder: 'rgba(18,17,17,0.08)', dialogShadow: 'rgba(18,17,17,0.22)',
  pickerScrim: 'rgba(18,17,17,0.30)', hud: 'rgba(0,0,0,0.45)', rowDrag: 'rgba(18,17,17,0.05)', ground: 'rgba(18,17,17,0.20)',
  markerGlow: 'rgba(18,17,17,0.18)', titleShadow: 'transparent',
  body: '#2B2828', body2: '#2B2828', body3: '#2B2828', secondary: '#5E5959', tertiary: '#767171', dim: '#767171',
} as const;
export const DARK_PALETTE = dark;
export const LIGHT_PALETTE = light;
export type Palette = Record<keyof typeof DARK_PALETTE, string>;
export const C = DARK_PALETTE;

export type Hue = { icon: [string, string]; grad: [string, string]; face: [string, string]; glow: string; accent: string; rgb: string };
const HUE = {
  rose: { icon: ['#FFE0EF', '#E5579F'], swatch: '#FF8FC8' },
  orchid: { icon: ['#FBDDFC', '#C855CF'], swatch: '#EC8BF0' },
  lilac: { icon: ['#F3DCFF', '#A452E0'], swatch: '#D485FC' },
  periwinkle: { icon: ['#E5E1FF', '#7464F0'], swatch: '#A99BFF' },
  iris: { icon: ['#DDE7FF', '#4F7BF0'], swatch: '#8FB0FF' },
  sky: { icon: ['#DDF1FF', '#3F9BE6'], swatch: '#86CCFF' },
} as const;
function hue(name: keyof typeof HUE): Hue {
  const [a, b] = HUE[name].icon;
  const hex = HUE[name].swatch.slice(1);
  const rgb = [0, 2, 4].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ');
  return { icon: [a, b], grad: [a, b], face: [a, b], glow: `rgba(${rgb},0.18)`, accent: b, rgb };
}
const rose = hue('rose'), orchid = hue('orchid'), lilac = hue('lilac'), periwinkle = hue('periwinkle'), iris = hue('iris'), sky = hue('sky');
// Keep legacy persisted names readable; new selections use the six v2 colours.
export const HUES: Record<HueName, Hue> = { rose, orchid, lilac, periwinkle, iris, sky,
  blue: iris, violet: lilac, mint: iris, amber: iris, pink: rose, cyan: sky, coral: rose, lime: iris, indigo: periwinkle } as Record<HueName, Hue>;
export const DECK_COLORS = HUE;
export const G = { red: ['#FFB49E', '#FF5747', '#DD1C2C'], ink: ['#4A4545', '#121111'], multi: ['#FFE0EF', '#F3DCFF', '#DDF1FF'],
  blue: iris.grad, violet: lilac.grad, mint: iris.grad, amber: iris.grad, pink: rose.grad } as const;

export const F = { display: 'BricolageGrotesque_700Bold', displayHeavy: 'BricolageGrotesque_700Bold', regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium', semibold: 'Figtree_600SemiBold', bold: 'Figtree_700Bold' };
export const TONE = {
  good: { bg: 'rgba(63,217,164,0.12)', fg: '#3FD9A4' }, warn: { bg: 'rgba(255,154,61,0.12)', fg: '#FF9A3D' },
  info: { bg: 'rgba(212,133,252,0.12)', fg: '#D485FC' }, bad: { bg: 'rgba(255,107,94,0.12)', fg: '#FF6B5E' },
  plain: { bg: 'rgba(255,255,255,0.05)', fg: '#E8E5E5' },
} as const;
export const EASE_SCREEN = Easing.bezier(0.2, 0.8, 0.2, 1);
export const EASE_SNAP = Easing.bezier(0.2, 0.8, 0.2, 1);
export const DUR = { fade: 160, scrim: 220, snapBack: 260, panel: 300, page: 320, sheetUp: 340, countUp: 600, theme: 420, landscapeAutohide: 3000, toast: 4500, holdIcon: 450, holdRedoAll: 1500, rise: 260, zoom: 260 };
export const FRAME_W = 390;
export const FRAME_H = 844;
