// AI-generated/modified with Claude (Anthropic), Iteration 2 (2026-10-14).
// Attribution: docs/ai-collaboration-prompts-iteration-2.md#design-prototype-ui-rebuild-october-14-2026
// OutLoud redesign: slide cards. The rendered PDF page fills the card
// (letterboxed on the hue's slide face); the design's stand-in layout (title, rule,
// bullets) is used only when no page image exists.
// OpenAI Codex portrait-only correction: docs/ai-collaboration-prompts-iteration-2.md#portrait-only-pdf-rotation-correction-october-15-2026
import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Image as SvgImage, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { HueName } from '../domain/hues';
import type { PageImage } from '../features/presentations/store';
import { Txt } from './frame';
import { F, HUES } from './tokens';

export const CARD_W = 358, CARD_H = 202, FOLD = 34, FOLD_R = 6;

type Pt = [number, number, number];
/** Rounded polygon: each point is [x, y, radius] (port of the prototype's roundPoly). */
export function roundPoly(pts: Pt[]): string {
  const n = pts.length, K = 0.5523;
  const f = (q: number[]) => q[0].toFixed(2) + ' ' + q[1].toFixed(2);
  let out = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], r = p[2] || 0;
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const r1 = Math.min(r, la / 2), r2 = Math.min(r, lb / 2);
    const s1 = [p[0] + ((a[0] - p[0]) / la) * r1, p[1] + ((a[1] - p[1]) / la) * r1];
    const s2 = [p[0] + ((b[0] - p[0]) / lb) * r2, p[1] + ((b[1] - p[1]) / lb) * r2];
    const c1 = [s1[0] + (p[0] - s1[0]) * K, s1[1] + (p[1] - s1[1]) * K], c2 = [s2[0] + (p[0] - s2[0]) * K, s2[1] + (p[1] - s2[1]) * K];
    out += (i === 0 ? 'M ' : 'L ') + f(s1) + ' C ' + f(c1) + ' ' + f(c2) + ' ' + f(s2) + ' ';
  }
  return out + 'Z';
}
const CLIPS: Record<string, string> = {};
export function cardClip(cutL: boolean, cutR: boolean): string {
  const key = (cutL ? 'L' : '') + (cutR ? 'R' : '');
  if (CLIPS[key]) return CLIPS[key];
  const W = CARD_W, H = CARD_H, pts: Pt[] = [[0, 0, 22], [W, 0, 22]];
  if (cutR) pts.push([W, H - FOLD, FOLD_R], [W - FOLD, H, FOLD_R]); else pts.push([W, H, 22]);
  if (cutL) pts.push([FOLD, H, FOLD_R], [0, H - FOLD, FOLD_R]); else pts.push([0, H, 22]);
  return (CLIPS[key] = roundPoly(pts));
}
const FLAP_R = roundPoly([[0, 0, 10], [FOLD, 0, FOLD_R], [0, FOLD, FOLD_R]]);
const FLAP_L = roundPoly([[FOLD, 0, 10], [FOLD, FOLD, FOLD_R], [0, 0, FOLD_R]]);

/** Fit an image of w×h inside a box, centred (never crops slide content). */
function contain(w: number, h: number, bw: number, bh: number) {
  if (!(w > 0 && h > 0)) return { x: 0, y: 0, width: bw, height: bh };
  const k = Math.min(bw / w, bh / h);
  return { x: (bw - w * k) / 2, y: (bh - h * k) / 2, width: w * k, height: h * k };
}

export const SlideCard = memo(function SlideCard({ hue, page, deckTitle, title, points, num, foldL, foldR, shadow = true }: {
  hue: HueName; page?: PageImage; deckTitle: string; title: string; points: readonly string[]; num: number; foldL: boolean; foldR: boolean; shadow?: boolean;
}) {
  const h = HUES[hue];
  const clipKey = 'clip' + (foldL ? 'L' : '') + (foldR ? 'R' : '');
  const box = page ? contain(page.w, page.h, CARD_W, CARD_H) : null;
  return (
    <View style={[styles.card, shadow && { boxShadow: `0px 24px 40px ${h.glow}` }]}>
      <Svg width={CARD_W} height={CARD_H} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id={clipKey}><Path d={cardClip(foldL, foldR)} /></ClipPath>
          <LinearGradient id={'face' + hue} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={h.face[0]} /><Stop offset="1" stopColor={h.face[1]} /></LinearGradient>
        </Defs>
        <G clipPath={`url(#${clipKey})`}>
          <Rect width={CARD_W} height={CARD_H} fill={`url(#face${hue})`} />
          {page && box && <SvgImage href={{ uri: page.uri }} x={box.x} y={box.y} width={box.width} height={box.height} preserveAspectRatio="none" />}
          <Rect x={0} y={0} width={CARD_W} height={1} fill="rgba(255, 255, 255, 0.2)" />
        </G>
      </Svg>
      {!page && (
        <View style={styles.standIn} pointerEvents="none">
          <Txt numberOfLines={1} style={styles.over}>{deckTitle}</Txt>
          <Txt numberOfLines={2} style={styles.title}>{title}</Txt>
          <View style={styles.rule} />
          {points.length ? (
            <View style={{ gap: 5, marginTop: 2 }}>
              {points.slice(0, 4).map(p => (
                <View key={p} style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={styles.dot} /><Txt numberOfLines={2} style={styles.bullet}>{p}</Txt>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ gap: 9, marginTop: 8 }}>
              {[0.78, 0.64, 0.5].map(w => <View key={w} style={[styles.bar, { width: `${w * 100}%` }]} />)}
            </View>
          )}
          <Txt style={[styles.num, { right: foldR ? 44 : 16 }]}>{num}</Txt>
        </View>
      )}
      {foldL && (
        <View pointerEvents="none" style={[styles.flap, { left: 0, filter: [{ dropShadow: { offsetX: 2, offsetY: -1, standardDeviation: 2, color: 'rgba(0, 0, 40, 0.35)' } }] }]}>
          <Svg width={FOLD} height={FOLD} viewBox="0 0 34 34">
            <Defs><LinearGradient id="gFlapL" x1="1" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="0.3" stopColor="#E8ECF7" /><Stop offset="0.52" stopColor="#B9C4E0" /></LinearGradient></Defs>
            <Path d={FLAP_L} fill="url(#gFlapL)" />
          </Svg>
        </View>
      )}
      {foldR && (
        <View pointerEvents="none" style={[styles.flap, { right: 0, filter: [{ dropShadow: { offsetX: -2, offsetY: -1, standardDeviation: 2, color: 'rgba(0, 0, 40, 0.35)' } }] }]}>
          <Svg width={FOLD} height={FOLD} viewBox="0 0 34 34">
            <Defs><LinearGradient id="gFlapR" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="0.3" stopColor="#E8ECF7" /><Stop offset="0.52" stopColor="#B9C4E0" /></LinearGradient></Defs>
            <Path d={FLAP_R} fill="url(#gFlapR)" />
          </Svg>
        </View>
      )}
    </View>
  );
});

/** Small slide preview (Review 104×58, Q&A 220×124). */
export function MiniSlide({ hue, page, title, width, height, radius, num }: { hue: HueName; page?: PageImage; title: string; width: number; height: number; radius: number; num?: number }) {
  const h = HUES[hue];
  const big = width > 150;
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', boxShadow: `0px ${big ? 16 : 8}px ${big ? 30 : 16}px ${h.glow}` }}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
        <Defs><LinearGradient id={'mini' + hue} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={h.face[0]} /><Stop offset="1" stopColor={h.face[1]} /></LinearGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#mini${hue})`} />
      </Svg>
      {page ? <Image source={{ uri: page.uri }} resizeMode="contain" style={StyleSheet.absoluteFill} /> : (
        <View style={{ padding: big ? 12 : 7, paddingHorizontal: big ? 14 : 8, gap: big ? 6 : 4 }}>
          <Txt numberOfLines={1} style={{ fontFamily: F.display, fontSize: big ? 15 : 9, color: '#FFFFFF' }}>{title}</Txt>
          <View style={{ width: big ? 24 : 14, height: big ? 3 : 2, borderRadius: 1, backgroundColor: 'rgba(255, 255, 255, 0.85)' }} />
          {(big ? [0.82, 0.66, 0.52] : [0.8, 0.62]).map((w, i) => (
            <View key={w} style={{ width: `${w * 100}%`, height: big ? 5 : 3, marginTop: big && i === 0 ? 4 : 0, borderRadius: 3, backgroundColor: big ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.3)' }} />
          ))}
          {big && num != null && <Txt style={{ position: 'absolute', right: 12, bottom: 9, fontFamily: F.semibold, fontSize: 10, color: 'rgba(255, 255, 255, 0.82)' }}>{num}</Txt>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, borderRadius: 22 },
  standIn: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingVertical: 16, paddingHorizontal: 18, gap: 6 },
  over: { paddingRight: 24, fontFamily: F.bold, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.75)' },
  title: { fontFamily: F.display, fontSize: 21, lineHeight: 23, letterSpacing: -0.4, color: '#FFFFFF', textShadowColor: 'rgba(0, 0, 0, 0.18)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  rule: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.85)' },
  dot: { width: 5, height: 5, marginTop: 5, borderRadius: 1.5, backgroundColor: '#FFFFFF' },
  bullet: { flex: 1, fontFamily: F.regular, fontSize: 12, lineHeight: 15, color: 'rgba(255, 255, 255, 0.94)' },
  bar: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.24)' },
  num: { position: 'absolute', bottom: 12, fontFamily: F.semibold, fontSize: 11, color: 'rgba(255, 255, 255, 0.82)' },
  flap: { position: 'absolute', bottom: 0, width: FOLD, height: FOLD },
});
