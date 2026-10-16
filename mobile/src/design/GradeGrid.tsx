// OpenAI Codex Review and Full review: docs/ai-collaboration/iteration-2/prompt-log.md#review-and-full-review-redesign-october-15-2026
import Svg, { Rect } from 'react-native-svg';
import { GRADE } from '../domain/analysis';

/** Four grade fills from the supplied full-review-grades.svg reference. */
export function GradeGrid({ size = 36 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden>
    <Rect x={4} y={4} width={18.5} height={18.5} rx={6} fill={GRADE.green.fill} />
    <Rect x={25.5} y={4} width={18.5} height={18.5} rx={6} fill={GRADE.yellow.fill} />
    <Rect x={4} y={25.5} width={18.5} height={18.5} rx={6} fill={GRADE.orange.fill} />
    <Rect x={25.5} y={25.5} width={18.5} height={18.5} rx={6} fill={GRADE.red.fill} />
  </Svg>;
}
