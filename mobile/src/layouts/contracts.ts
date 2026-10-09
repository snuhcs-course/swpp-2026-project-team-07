/** Public presentation contracts. Type-only controller projections contain display state,
 * guarded commands and opaque native surfaces, never raw players/recorders or persistence.
 * Layouts import this module with `import type`; it adds no runtime integration dependency. */
import type { ComponentType, ReactNode } from 'react';
import type { useUtilitiesController } from '../features/home/UtilitiesScreen';
import type { useSetupController } from '../features/pdf/ViewerScreen';
export type UtilitiesModel = ReturnType<typeof useUtilitiesController>;
export type SetupModel = ReturnType<typeof useSetupController>;
export interface Layout {
  readonly id: string;
  readonly name: string;
  Library: ComponentType<{ model: LibraryModel }>;
  Recording: ComponentType<{ model: RecordingModel }>;
  Message: ComponentType<MessageProps>;
  Feedback: ComponentType<{ model: FeedbackModel }>;
  Review: ComponentType<{ model: ReviewModel }>;
  Preview: ComponentType<{ model: PreviewModel }>;
  Thumbnail: ComponentType<ThumbnailProps>;
  SampleSlide: ComponentType<SampleSlideProps>;
  Transcript: ComponentType<{ spans: ReviewModel['transcriptSpans'] }>;
  RootNavigation: ComponentType;
  MainNavigation: ComponentType;
  Utilities: ComponentType<{ model: UtilitiesModel }>;
  Setup: ComponentType<{ model: SetupModel }>;
}

import type { useLibraryController } from '../features/pdf/LibraryScreen';
export type LibraryModel = ReturnType<typeof useLibraryController>;

import type { useRecordingController } from '../features/recording/RehearsalScreen';
export type RecordingModel = ReturnType<typeof useRecordingController>;

export interface MessageProps { title: string; message?: string; actionLabel?: string; onAction?: () => void; }

import type { useFeedbackController } from '../features/feedback/FeedbackPanel';
export type FeedbackModel = ReturnType<typeof useFeedbackController>;

import type { useSavedReviewController } from '../features/recording/SavedAttemptScreen';
export type ReviewModel = ReturnType<typeof useSavedReviewController>['model'] & { feedback?: FeedbackModel };

import type { usePreviewController } from '../features/transcription/ResultsScreen';
export type PreviewModel = ReturnType<typeof usePreviewController>;

export interface ThumbnailProps { title: string; stage: ReactNode; }
export interface SampleSlideProps { index: number; slide: { title: string; eyebrow: string; body: string }; }
