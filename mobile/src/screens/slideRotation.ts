import type { useFrameLayout } from '../design/frame';
import type { PageImage } from '../features/presentations/store';

type FrameLayout = ReturnType<typeof useFrameLayout>;
export type SlideRect = { left: number; top: number; width: number; height: number };

export function landscapeSlideRect(width: number, height: number): SlideRect {
  const left = 68;
  const cardWidth = Math.min(Math.max(120, width - left - 12), Math.max(100, height) * 16 / 9);
  const cardHeight = cardWidth * 9 / 16;
  return { left, top: Math.max(0, (height - cardHeight) / 2), width: cardWidth, height: cardHeight };
}

function fittedSlide(rect: SlideRect, page?: PageImage): SlideRect {
  if (!page || !(page.w > 0 && page.h > 0)) return rect;
  const scale = Math.min(rect.width / page.w, rect.height / page.h);
  const width = page.w * scale, height = page.h * scale;
  return { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
}

function toScreen(frame: FrameLayout, x: number, y: number) {
  const { left, top, s } = frame.info;
  return frame.rotatedPortrait
    ? { x: left + (frame.designH - y) * s, y: top + x * s }
    : { x: left + x * s, y: top + y * s };
}

function toCanvas(frame: FrameLayout, x: number, y: number) {
  const { left, top, s } = frame.info;
  return frame.rotatedPortrait
    ? { x: (y - top) / s, y: frame.designH - (x - left) / s }
    : { x: (x - left) / s, y: (y - top) / s };
}

/** Project the destination into the still-mounted source canvas. */
export function slideRotationPose(source: FrameLayout, target: FrameLayout, start: SlideRect, end: SlideRect, page?: PageImage) {
  const from = fittedSlide(start, page), to = fittedSlide(end, page);
  const screen = toScreen(target, to.left + to.width / 2, to.top + to.height / 2);
  const targetCenter = toCanvas(source, screen.x, screen.y);
  const first = toCanvas(source, 0, 0), last = toCanvas(source, source.width, source.height);
  const scale = target.info.s / source.info.s;
  return {
    from,
    viewport: { left: Math.min(first.x, last.x), top: Math.min(first.y, last.y), width: Math.abs(last.x - first.x), height: Math.abs(last.y - first.y) },
    dx: targetCenter.x - from.left - from.width / 2,
    dy: targetCenter.y - from.top - from.height / 2,
    angle: (Number(target.rotatedPortrait) - Number(source.rotatedPortrait)) * 90,
    scaleX: to.width * scale / from.width,
    scaleY: to.height * scale / from.height,
  };
}
