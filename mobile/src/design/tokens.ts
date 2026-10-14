// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: design tokens copied from the design bundle (tokens.json).
import { Easing } from 'react-native-reanimated';
import type { HueName } from '../domain/hues';

export const DARK = '#0A0A0D';
export const C = {
  text: '#F5F5F7', secondary: '#A7A9B4', tertiary: '#8A8D99', body: '#E6E7EC', dim: '#6E7080',
  good: '#3FD9A4', warn: '#FFC266', warnAlt: '#FFB547', bad: '#FF9C90', badAlt: '#FF7A6B', info: '#A9C1FF',
  track: '#1F1F27', dialog: '#1A1A21', toast: '#1C1C23', toastBorder: '#2A2A33', yellow: '#FFD866', coralText: '#FF8A7E',
};

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
export const DUR = { rise: 460, zoom: 420, fade: 420 };

/** The design frame. Every screen is laid out in these units and scaled to the device. */
export const FRAME_W = 390;
export const FRAME_H = 844;
