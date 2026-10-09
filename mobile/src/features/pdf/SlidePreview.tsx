import { demoSlides } from '../../fixtures/demo';
import { activeLayout } from '../../layouts/registry';
export function SlidePreview({ index }: { index: number }) { return <activeLayout.SampleSlide index={index} slide={demoSlides[index] ?? demoSlides[0]} />; }
