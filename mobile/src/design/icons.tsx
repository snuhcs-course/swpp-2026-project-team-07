// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// OpenAI Codex light-mode glyphs: docs/ai-collaboration/iteration-2/prompt-log.md#guide-based-light-mode-october-15-2026
// Attribution: docs/ai-collaboration/iteration-2/prompt-log.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: chroma presentation art and hint glyphs from the design bundle;
// status icons below use the later monochrome outline treatment.
// OpenAI Codex landscape follow-up: docs/ai-collaboration/iteration-2/prompt-log.md#landscape-rehearsal-implementation-october-15-2026
// OpenAI Codex Review bars: docs/ai-collaboration/iteration-2/prompt-log.md#rehearse-review-bars-icon-october-15-2026
// OpenAI Codex minimal status glyphs: docs/ai-collaboration/iteration-2/prompt-log.md#minimal-status-icons-october-15-2026
import { memo } from 'react';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { HueName, IconId } from '../domain/hues';
import type { IconKey } from '../domain/analysis';
import { GLYPHS, PRESENTATION_SHAPES } from './iconData';
import { HUES } from './tokens';
import { useTheme } from './theme';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A presentation icon: hue gradient fill plus a white sheen at 28% (SPEC §2 "Chroma icons"). */
export const PresentationIcon = memo(function PresentationIcon({ icon, hue, size, style }: {
  icon: IconId; hue: HueName; size: number; style?: StyleProp<ViewStyle>;
}) {
  const shape = PRESENTATION_SHAPES[icon] ?? PRESENTATION_SHAPES.present;
  const [from, to] = HUES[hue].icon;
  const id = 'gIc' + cap(hue);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={[{ overflow: 'visible' }, style]}>
      <Defs>
        <LinearGradient id={id} gradientUnits="userSpaceOnUse" x1="5" y1="1.5" x2="12" y2="23">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
        <LinearGradient id="gIcSheen" gradientUnits="userSpaceOnUse" x1="0" y1="1" x2="0" y2="13">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <G fill={`url(#${id})`}>{shape()}</G>
      <G fill="url(#gIcSheen)" opacity={0.28}>{shape()}</G>
    </Svg>
  );
});

/** Single-stroke status artwork, aligned with the monochrome gesture hints. */
const MINIMAL_UI: Record<IconKey, () => ReactNode> = {
  'i-timer': () => <><Circle cx={12} cy={13} r={7.5} /><Path d="M12 13V9.5 M9.5 2.5h5 M12 5.5v-3 M19 6l1.5-1.5" /></>,
  'i-clock': () => <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3.5 2" /></>,
  'i-faster': () => <><Circle cx={10.5} cy={13} r={7.5} /><Path d="M10.5 9v4l2.5 1.5 M16.5 5.5h5v5 M21.5 5.5l-4.5 4.5" /></>,
  'i-slower': () => <><Circle cx={10.5} cy={11} r={7.5} /><Path d="M10.5 7v4l2.5 1.5 M16.5 18.5h5v-5 M21.5 18.5L17 14" /></>,
  'i-plus': () => <Path d="M12 4v16 M4 12h16" />,
  'i-doc': () => <><Path d="M7 2.5h7l4.5 4.5v13A1.5 1.5 0 0 1 17 21.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5Z M14 2.5V7h4.5 M9 12h6 M9 16h6" /></>,
  'i-mic': () => <><Rect x={9} y={3} width={6} height={12} rx={3} /><Path d="M6 11.5a6 6 0 0 0 12 0 M12 17.5V21 M9 21h6" /></>,
  'i-replay': () => <Path d="M4 8V3.5 M4 8h4.5 M4.5 8A8.5 8.5 0 1 1 3.5 15 M12 8.5V12l2.5 1.5" />,
  'i-bubble': () => <><Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5.5 3v-3A2.5 2.5 0 0 1 4 14.5Z" /><Circle cx={8.5} cy={10.5} r={0.5} /><Circle cx={12} cy={10.5} r={0.5} /><Circle cx={15.5} cy={10.5} r={0.5} /></>,
  'i-flag': () => <Path d="M5 21V3 M5 4h13l-2.5 4L18 12H5" />,
  'i-arrow': () => <Path d="M3 12h17 M15 7l5 5-5 5" />,
  'i-loop': () => <Path d="M20 8a8.5 8.5 0 0 0-14-2L4 8 M4 4v4h4 M4 16a8.5 8.5 0 0 0 14 2l2-2 M20 20v-4h-4" />,
  'i-wave': () => <Path d="M3 12h2l2-5 3 10 4-12 3 9 2-2h2" />,
  'i-check': () => <><Circle cx={12} cy={12} r={9} /><Path d="m7.5 12 3 3 6-6" /></>,
  'i-gauge': () => <><Path d="M4.5 17a9 9 0 1 1 15 0 M3.5 18.5h17 M12 14l4-5" /><Circle cx={12} cy={14} r={1} /></>,
  'i-bulb': () => <><Path d="M9 17c0-1.5-3-2.5-3-6a6 6 0 0 1 12 0c0 3.5-3 4.5-3 6 M9 17h6 M9.5 20h5 M10.5 22h3" /></>,
  'i-chart': () => <><Path d="M4 4v16h16 M8 16v-4 M12 16V8 M16 16v-7" /></>,
  'i-slides': () => <><Rect x={7} y={4} width={14} height={15} rx={1.5} /><Path d="M4 7H3v14h14v-1 M10 9h8 M10 13h6" /></>,
  'i-text': () => <Path d="M4 6h16 M4 11h16 M4 16h11 M4 20h7" />,
  'i-trash': () => <><Path d="M4 6h16 M9 6V4h6v2 M6.5 6l1 14h9l1-14 M10 10v7 M14 10v7" /></>,
};

export const UIIcon = memo(function UIIcon({ name, size, style }: { name: IconKey; size: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const icon = MINIMAL_UI[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G fill="none" stroke={c.secondary} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{icon()}</G>
    </Svg>
  );
});

export type GlyphName = 'h-hold' | 'h-down' | 'h-spin' | 'h-tap' | 'h-up' | 'h-dn' | 'h-vert' | 'h-landscape' | 'h-portrait' | 'h-rotate-slide' | 'h-review-bars' | 'p-play' | 'p-pause' | 'g-redo';
/** Line glyphs used in hint rows and play buttons; they take the text colour. */
export const Glyph = memo(function Glyph({ name, size, color, style }: { name: GlyphName; size: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const g = GLYPHS[name];
  if (!g) return null;
  return <Svg width={size} height={size} viewBox={g.viewBox} style={style}>{g.body(color ?? (name === 'g-redo' ? '#FFFFFF' : c.secondary))}</Svg>;
});
