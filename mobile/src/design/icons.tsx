// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: chroma icons, UI icons and hint glyphs from the design bundle.
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, G, LinearGradient, Stop } from 'react-native-svg';
import type { HueName, IconId } from '../domain/hues';
import type { IconKey } from '../domain/analysis';
import { GLYPHS, GRADIENT_DEFS, PRESENTATION_SHAPES, UI_ICONS } from './iconData';
import { HUES } from './tokens';

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

/** Small multicolour UI icons (stopwatch, speedometer, bubble, flag…), 48-unit artwork. */
export const UIIcon = memo(function UIIcon({ name, size, style }: { name: IconKey; size: number; style?: StyleProp<ViewStyle> }) {
  const icon = UI_ICONS[name];
  if (!icon) return null;
  return (
    <Svg width={size} height={size} viewBox={icon.viewBox} style={style}>
      <Defs>{icon.grads.map(g => <GradientDef key={g} id={g} />)}</Defs>
      {icon.body()}
    </Svg>
  );
});
function GradientDef({ id }: { id: string }) { const make = GRADIENT_DEFS[id]; return make ? make() : null; }

export type GlyphName = 'h-hold' | 'h-down' | 'h-spin' | 'h-tap' | 'h-up' | 'h-dn' | 'h-vert' | 'p-play' | 'p-pause' | 'g-redo';
/** Line glyphs used in hint rows and play buttons; they take the text colour. */
export const Glyph = memo(function Glyph({ name, size, color = '#A7A9B4', style }: { name: GlyphName; size: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const g = GLYPHS[name];
  if (!g) return null;
  return <Svg width={size} height={size} viewBox={g.viewBox} style={style}>{g.body(color)}</Svg>;
});
