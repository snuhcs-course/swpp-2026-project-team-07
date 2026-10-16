// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode palette: docs/ai-collaboration-prompts-iteration-2.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: design tokens copied from the design bundle (tokens.json).
import { Easing } from 'react-native-reanimated';
import type { HueName } from '../domain/hues';

export const DARK = '#0A0A0D';
export const DARK_PALETTE = {
  bg: DARK, strong: '#FFFFFF', text: '#F5F5F7', body: '#E6E7EC', body2: '#D9DAE0', body3: '#C9CBD3',
  secondary: '#A7A9B4', tertiary: '#8A8D99', dim: '#6E7080', meta: 'rgba(255,255,255,0.62)',
  track: '#1F1F27', dotOff: '#45464F', hair: 'rgba(255,255,255,0.1)',
  surface04: 'rgba(255,255,255,0.04)', surface06: 'rgba(255,255,255,0.06)', surface08: 'rgba(255,255,255,0.08)',
  surface10: 'rgba(255,255,255,0.1)', surface12: 'rgba(255,255,255,0.12)',
  border06: 'rgba(255,255,255,0.06)', border08: 'rgba(255,255,255,0.08)', border12: 'rgba(255,255,255,0.12)',
  border14: 'rgba(255,255,255,0.14)', border30: 'rgba(255,255,255,0.3)', border50: 'rgba(255,255,255,0.5)', border55: 'rgba(255,255,255,0.55)',
  ink05: 'rgba(255,255,255,0.05)', ink08: 'rgba(255,255,255,0.08)', ink14: 'rgba(255,255,255,0.14)',
  ink16: 'rgba(255,255,255,0.16)', ink18: 'rgba(255,255,255,0.18)', ink20: 'rgba(255,255,255,0.2)',
  ink28: 'rgba(255,255,255,0.28)', ink40: 'rgba(255,255,255,0.4)', ink45: 'rgba(255,255,255,0.45)',
  ink55: 'rgba(255,255,255,0.55)', ink70: 'rgba(255,255,255,0.7)',
  dialog: '#1A1A21', dialogShadow: 'rgba(0,0,0,0.55)', scrim: 'rgba(0,0,0,0.62)',
  pickerScrim: 'rgba(8,8,12,0.7)', toast: '#1C1C23', toastBorder: '#2A2A33', hud: 'rgba(10,10,13,0.74)',
  rowDrag: '#15151B', ground: 'rgba(0,0,0,0.32)', markerGlow: 'rgba(255,255,255,0.5)',
  titleShadow: 'rgba(0,0,0,0.35)',
  good: '#3FD9A4', warn: '#FFC266', warnAlt: '#FFB547', bad: '#FF9C90', badAlt: '#FF7A6B',
  coralText: '#FF8A7E', info: '#A9C1FF', violetText: '#CBB8FF', gold: '#FFD866', goldText: '#FFE08A',
  yellow: '#FFD866',
};
export type Palette = Record<keyof typeof DARK_PALETTE, string>;
export const LIGHT_PALETTE: Palette = {
  bg: '#F6F6F9', strong: '#0A0B10', text: '#15171E', body: '#2A2D37', body2: '#3A3D48', body3: '#4A4D59',
  secondary: '#5F6270', tertiary: '#767987', dim: '#A1A4AF', meta: 'rgba(21,23,30,0.58)',
  track: 'rgba(21,23,30,0.09)', dotOff: 'rgba(21,23,30,0.2)', hair: 'rgba(21,23,30,0.1)',
  surface04: 'rgba(255,255,255,0.45)', surface06: 'rgba(255,255,255,0.55)', surface08: 'rgba(255,255,255,0.68)',
  surface10: 'rgba(255,255,255,0.78)', surface12: 'rgba(255,255,255,0.88)',
  border06: 'rgba(21,23,30,0.06)', border08: 'rgba(21,23,30,0.07)', border12: 'rgba(21,23,30,0.1)',
  border14: 'rgba(21,23,30,0.12)', border30: 'rgba(21,23,30,0.24)', border50: 'rgba(21,23,30,0.42)', border55: 'rgba(21,23,30,0.45)',
  ink05: 'rgba(21,23,30,0.035)', ink08: 'rgba(21,23,30,0.07)', ink14: 'rgba(21,23,30,0.08)',
  ink16: 'rgba(21,23,30,0.13)', ink18: 'rgba(21,23,30,0.15)', ink20: 'rgba(21,23,30,0.17)',
  ink28: 'rgba(21,23,30,0.22)', ink40: 'rgba(21,23,30,0.32)', ink45: 'rgba(21,23,30,0.36)',
  ink55: 'rgba(21,23,30,0.45)', ink70: 'rgba(21,23,30,0.6)',
  dialog: '#FFFFFF', dialogShadow: 'rgba(21,23,30,0.18)', scrim: 'rgba(21,23,30,0.3)',
  pickerScrim: 'rgba(246,246,249,0.72)', toast: '#FFFFFF', toastBorder: 'rgba(21,23,30,0.08)', hud: 'rgba(255,255,255,0.84)',
  rowDrag: 'rgba(21,23,30,0.05)', ground: 'rgba(21,23,30,0.2)', markerGlow: 'rgba(21,23,30,0.18)',
  titleShadow: 'transparent',
  good: '#08875C', warn: '#A86200', warnAlt: '#A86200', bad: '#C2392C', badAlt: '#C2392C',
  coralText: '#C8402F', info: '#2C50CF', violetText: '#5A35CC', gold: '#946300', goldText: '#8A5A00',
  yellow: '#FFD866',
};
/** Legacy alias; colour-bearing styles are converted by createThemedStyles. */
export const C = DARK_PALETTE;

export type Hue = {
  /** Icon gradient, light top-left → dark bottom. */
  icon: [string, string];
  /** Large gradients (rings, small icons) use slightly different stops in the prototype. */
  grad: [string, string];
  /** Slide face, 135°. */
  face: [string, string];
  glow: string;
  accent: string;
  rgb: string;
};
export const HUES: Record<HueName, Hue> = {
  blue: { icon: ['#7CC2FF', '#2D5BFF'], grad: ['#7CC2FF', '#2D5BFF'], face: ['#4677FF', '#1F3BD6'], glow: 'rgba(45, 91, 255, 0.32)', accent: '#2D5BFF', rgb: '58, 110, 255' },
  violet: { icon: ['#C9A8FF', '#6A3BF0'], grad: ['#C9A8FF', '#6A3BF0'], face: ['#8657FF', '#5226D9'], glow: 'rgba(106, 59, 240, 0.32)', accent: '#6A3BF0', rgb: '128, 82, 255' },
  mint: { icon: ['#9AF7D6', '#0EA877'], grad: ['#9AF7D6', '#0EA877'], face: ['#0F9E73', '#06704F'], glow: 'rgba(14, 168, 119, 0.30)', accent: '#0EA877', rgb: '20, 196, 146' },
  amber: { icon: ['#FFE58C', '#FF8A1E'], grad: ['#FFE58C', '#FF8A1E'], face: ['#E26A0A', '#A84A04'], glow: 'rgba(255, 138, 30, 0.34)', accent: '#FF8A1E', rgb: '255, 152, 46' },
  pink: { icon: ['#FFB7E0', '#E23D8D'], grad: ['#FFB7E0', '#E23D8D'], face: ['#E4448F', '#A9195F'], glow: 'rgba(226, 61, 141, 0.30)', accent: '#E23D8D', rgb: '238, 76, 156' },
  cyan: { icon: ['#8DF0FF', '#0AA6C8'], grad: ['#8DF0FF', '#0AA6C8'], face: ['#0E9BBE', '#076F8C'], glow: 'rgba(10, 166, 200, 0.32)', accent: '#0AA6C8', rgb: '20, 180, 220' },
  coral: { icon: ['#FFB59E', '#F0573A'], grad: ['#FFB49A', '#F0573A'], face: ['#E5533A', '#A8301C'], glow: 'rgba(240, 87, 58, 0.32)', accent: '#F0573A', rgb: '245, 100, 70' },
  lime: { icon: ['#D6F59A', '#5A9E12'], grad: ['#E3FF8A', '#6CC21A'], face: ['#5A9E12', '#3C7008'], glow: 'rgba(108, 194, 26, 0.30)', accent: '#5A9E12', rgb: '130, 205, 50' },
  indigo: { icon: ['#B7B9FF', '#3D3FD1'], grad: ['#A9B4FF', '#3D3FD1'], face: ['#4B4FE0', '#2A2CA6'], glow: 'rgba(61, 63, 209, 0.34)', accent: '#3D3FD1', rgb: '90, 96, 240' },
};
/** Fixed gradients used by the UI icons (i-*). */
export const G = {
  red: ['#FF9A7C', '#EC2A35'], ink: ['#4B4F5E', '#14161D'], multi: ['#7CC2FF', '#9B7CFF', '#FF7EB6'],
  blue: HUES.blue.grad, violet: HUES.violet.grad, mint: HUES.mint.grad, amber: HUES.amber.grad, pink: HUES.pink.grad,
} as const;

export const F = {
  display: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
};

/** Tinted chip colours (SPEC §2 status colours). */
export const TONE = {
  good: { bg: 'rgba(63, 217, 164, 0.16)', fg: '#3FD9A4' },
  warn: { bg: 'rgba(255, 181, 71, 0.16)', fg: '#FFC266' },
  info: { bg: 'rgba(110, 150, 255, 0.18)', fg: '#A9C1FF' },
  bad: { bg: 'rgba(255, 122, 107, 0.18)', fg: '#FF9C90' },
  plain: { bg: 'rgba(255, 255, 255, 0.08)', fg: '#E6E7EC' },
} as const;

/** Motion. */
export const EASE_SCREEN = Easing.bezier(0.2, 0.8, 0.2, 1);
export const EASE_SNAP = Easing.bezier(0.25, 1, 0.5, 1);
// OpenAI Codex page fade: docs/ai-collaboration-prompts-iteration-2.md#smooth-page-fades-october-15-2026
export const DUR = { rise: 260, zoom: 260, fade: 260 };

/** The design frame. Every screen is laid out in these units and scaled to the device. */
export const FRAME_W = 390;
export const FRAME_H = 844;
