import type { Layout, ReviewModel } from '../contracts';
import { refactorLayout } from '../refactor';
import { ReviewView } from '../refactor/ReviewView';
import { MainNavigation } from './MainNavigation';
function Review({ model }: { model: ReviewModel }) { return <ReviewView model={model} arrangement="top-controls" />; }
export const contractTestLayout: Layout = { ...refactorLayout, id: 'contract-test', name: 'Layout contract test', MainNavigation, Review };
