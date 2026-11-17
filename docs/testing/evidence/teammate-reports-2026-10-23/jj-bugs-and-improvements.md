# Nakajima Version: Bugs and Improvements Report

## Scope

This report summarizes bugs and improvement opportunities identified in the OutLoud app around the Nakajima version submission. It focuses on the functional app and its user interface. Later demo-only changes are outside this report's scope.

The items below are written as observations and recommendations for follow-up. They should be rechecked on the submitted build before being treated as confirmed release blockers, since behavior may differ between builds or devices.

## Summary

The main opportunities are to make navigation feel responsive, keep slide transcripts aligned with the recording, make PDF setup options clear, prevent presentation numbering from becoming inconsistent, and address UI defects throughout the app. The gesture-based interface also needs onboarding: a first-launch tutorial and a persistent way to open it again would help users understand navigation without relying on trial and error.

## Findings and recommendations

### 1. Home carousel and page navigation can feel slow

**Observation:** The Home carousel could visibly stutter while presentations were spun or moved. Transitions back from presentation and recording screens could also feel delayed.

**User impact:** The Home screen is the app's main entry point. Stuttering during its primary gesture makes the interface feel unresponsive, while a pause when returning Home interrupts the rehearsal flow.

**Recommended improvement:** Profile carousel updates and screen transitions on a physical device. Reduce unnecessary rerenders and expensive visual effects during gestures. Keep navigation feedback immediate, and verify that performance remains smooth with several presentations in the carousel.

**Suggested checks:**

- Spin and move through a carousel containing multiple presentations.
- Navigate from Home to a presentation, into recording, and back Home repeatedly.
- Confirm that animations do not block touch input or delay the destination screen.

### 2. Slide navigation during recording can disrupt transcript alignment

**Observation:** Moving backward through slides while a recording is active can interfere with the association between audio segments and slides. The intended transcript behavior uses slide changes as boundaries for the next slide's transcript.

**User impact:** If a slide is revisited or the slide index moves backward during a take, transcript sections may be assigned to the wrong slide or appear out of sequence. That makes slide-by-slide review less trustworthy.

**Recommended improvement:** Disable backward slide navigation while recording is active. Continue to allow slide navigation before recording starts and after it stops. If backward navigation during a take is needed in the future, define explicit timestamp-based behavior for revisited slides before enabling it.

**Suggested checks:**

- Confirm that forward slide changes during recording create transcript boundaries at the correct timestamps.
- Confirm backward navigation is unavailable while recording is active.
- Confirm both backward and forward navigation work when recording is stopped.
- Confirm the transcript remains ordered and attached to the correct slides after stopping and reopening a recording.

### 3. PDF setup should clearly collect presentation context

**Observation:** The PDF upload/setup flow needed visible controls for the expected presentation duration and the target audience. The expected duration is relevant to timing feedback, while the audience can help put feedback in context.

**User impact:** If these inputs are missing or hard to find, users cannot provide information that the review experience needs. Timing feedback may also be difficult to interpret if it is not compared with the user's intended presentation length.

**Recommended improvement:** Present the duration control and audience choices as part of the upload flow. Make it clear that audience selection is optional. Carry the selected duration into review calculations and explain timing feedback relative to that target.

**Suggested checks:**

- Confirm the duration control is visible after selecting a PDF and before finalizing setup.
- Confirm the audience options are visible and optional.
- Confirm selected values persist when moving forward and back through setup.
- Confirm review timing feedback uses the chosen duration rather than a fixed default.

### 4. Presentation numbering should remain sequential after deletion

**Observation:** A reported issue involved presentation labels retaining old numbers after an item was deleted. For example, deleting the second item could leave the following item labeled as number three.

**User impact:** Stale numbering makes the Home list confusing and can make instructions such as “open presentation 2” ambiguous.

**Recommended improvement:** Derive the displayed number from the presentation's current position in the list. Avoid treating a presentation's original insertion number as its permanent display number.

**Suggested checks:**

- Add three presentations and delete the first, middle, and last items in separate checks.
- Confirm the remaining visible labels are sequential after each deletion.
- Add another presentation after deletion and confirm it receives the next position-based number.
- Confirm deleting an item does not change the identity or saved data of the other presentations.

### 5. UI defects need a systematic pass across the app

**Observation:** UI details required continued refinement across screens, including layout consistency, icon presentation, labels, and visual states. These issues can be easy to miss when reviewing each page in isolation.

**User impact:** Inconsistent layouts or unclear visual states can make controls harder to understand, reduce confidence in the app, and cause users to miss available actions. Small visual defects can also become more noticeable when returning to a screen repeatedly.

**Recommended improvement:** Perform a focused UI review of the full user journey on a physical device. Check that spacing, alignment, typography, icons, colors, and button states are consistent across Home, upload/setup, presentation preview, recording, transcript, review, and Q&A. Check both light and dark themes where supported and include smaller device sizes.

**Suggested checks:**

- Verify text and controls are not clipped, overlapped, or obscured by device system areas.
- Confirm icons and their descriptions remain aligned and legible on every screen.
- Confirm enabled, disabled, selected, loading, and empty states are visually distinct.
- Confirm backgrounds and foreground text maintain sufficient contrast in both themes.
- Check that opening and dismissing overlays does not leave behind stale borders, backdrops, or dimmed content.
- Repeat the same checks after navigating between screens, not only on a fresh app launch.

### 6. Gesture navigation needs onboarding and an always-available guide

**Observation:** The app uses gestures for navigation and controls. A first-time user may not know how to change slides, return Home, open review, or use other gesture-based actions.

**User impact:** Without guidance, users may assume an action is unavailable, trigger the wrong gesture, or need someone to explain the interface. Gesture discovery is especially difficult when the gestures are central to the app and are not represented by conventional buttons.

**Recommended improvement:** Add a short tutorial that appears the first time the app opens. It should demonstrate the essential gestures with concise visual examples and plain-language instructions. Include a persistent Help, Tutorial, or Gestures entry in the existing UI so a user can reopen the guide later. The guide should explain navigation and controls without interrupting normal use after it has been dismissed.

**Suggested tutorial content:**

1. How to move between presentations on Home.
2. How to open a presentation and move between slides.
3. How to start and stop a recording.
4. What slide navigation does during an active recording.
5. How to return Home or go back to the previous screen.
6. Where to find transcript, review, and Q&A features.
7. How to reopen the tutorial from the app's Help/Gestures entry.

**Suggested checks:**

- Show the tutorial on first launch and allow users to dismiss or complete it.
- Do not show it on every launch after completion, unless the user explicitly chooses to replay it.
- Make the tutorial accessible from a stable, easy-to-find location in the app.
- Ensure tutorial examples match the gestures and navigation behavior in the submitted build.
- Check that the tutorial is readable and usable on small screens and with either theme.

## Recommended priority

| Priority | Area | Reason |
| --- | --- | --- |
| High | Recording and transcript alignment | Incorrect slide-to-transcript mapping undermines the core review experience. |
| High | Home and navigation performance | Stutter or delayed navigation affects frequent, primary interactions. |
| High | Gesture onboarding | Users need to understand how to operate the app's central navigation model. |
| Medium | PDF setup context | Duration and audience improve the relevance and clarity of feedback. |
| Medium | Sequential presentation numbering | Correct numbering avoids confusion after list changes. |
| Medium | Full UI consistency pass | A systematic pass can catch visual defects across the whole journey. |

## Closing comment

OutLoud's core workflow depends on users moving smoothly from presentation setup to rehearsal and then to slide-by-slide review. Follow-up work should prioritize responsive navigation and reliable transcript alignment, while also making the gesture-based UI easier to learn and revisit. A first-launch tutorial paired with an always-available guide would address the onboarding gap without requiring new gestures to be memorized.
