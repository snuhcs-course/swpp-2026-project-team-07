# PR 31 review, playback, statistics and Q&A inventory
Pinned source: f1af9dd9737e2ac9adbe8a45186f0e2722863e60, /private/tmp/outloud-pr31-f1af9dd. Read-only source inventory, no device/runtime claim.

## Routing and exclusions
- Actual ScreenName union is home, upload, rehearse, review, full, compare, qa (`mobile/src/screens/shared.ts:12`; mounted at `AppShell.tsx:142-148`). There is no standalone Statistics screen, global bottom tab bar, login, profile or settings route.
- First saved take routes to full review; later saved takes route to slide review (`domain/run.ts:144-145`). FullReview can be opened from Home score ring; Review button on Rehearse honors first-vs-later rule. Compare resolves into same routing.
- Review uses inline playback/transcript/correction/tools; TakePlayback is a recovery details sheet, not the normal Review screen (`ReviewScreen.tsx:115-122`; `RehearseScreen.tsx:522-523`).

## Slide Review (normal screen)
- Header: deck title; relative run label. Prominent Full Review button + `All slides · assessed/recorded assessed · findings findings` (`ReviewScreen.tsx:92-98`).
- Scroll body: Slide score ring; Slide x of n; actual time vs required/default/suggested target; fillers; verified findings. Times per slide bars + bar labels with scores; tap changes selected slide (`ReviewScreen.tsx:101-114`).
- Selected recording card: miniature slide preview and slide title; Play/Pause; 6px progress strip; elapsed/total when selected; transcript, each sentence timestamp and word highlighting (`ReviewSlidePlayback.tsx:45-58,61-65`). Play disabled absent part, zero duration or unavailable local audio (`:49-50`).
- If slide never recorded: preview + `No saved audio for this slide`; `Record this slide to receive AI feedback` (`ReviewScreen.tsx:115-122`).
- Remaining vertical content: recording tools accordion, Slide score panel, AI feedback (`ReviewScreen.tsx:118-122`).
- Bottom hints/buttons: down Back to slides (or Full review when entered from full), up Audience Q&A. Hardware Back obeys same source; upward swipe outside scroll-content opens Q&A; downward from top returns (`ReviewScreen.tsx:57-69,124`). Full review button returns to existing full layer where applicable (`:59`).

## Review transcript/correction states
- Transcript header; Check transcription action where correction state exists. Disabled while checking, conflict or active suggestion job (`TranscriptCorrections.tsx:223-239`).
- Sentence row: timestamp and sentence tap play source interval; currently spoken word highlighted; suspected words highlighted + separate `Correct “word”` chips. Horizontal sentence swipe >90 moves to previous/next slide if movable/in bounds. Edge warning describes slide boundary and swipe direction; immutable boundary gives timing note. Corrected sentences offer Restore original (`TranscriptCorrections.tsx:270-349`).
- Open suggestion card: `Did you say “word”?`; reason; one button per proposed alternative; Keep original; Play audio; Close (`TranscriptCorrections.tsx:216-218,250-267`). Choosing an alternate saves a confirmed correction and may mark feedback outdated; moved speech retains original recording and gets `Moved speech transcript` section (`:35-46,66-102,126-135`).
- Correction sync: `Saved on phone · sync pending`; Sync corrections action (disabled busy). Conflict shows Use server / Keep mine. Slide-context dependency shows Retry slide context. Uncertain provider request shows inline `Retry transcription suggestions?` + Retry / Cancel (`:136-142,164-200`).
- Empty transcripts: Uploading your take; Transcribing (worker detail); Couldn't upload this take · tap to retry; Transcription stopped · tap to retry; Waiting for your OK to transcribe; Transcription not started · tap to start; interrupted/audio kept; missing take; saved offline; No speech detected; Nothing said on this slide; unaligned text with `Word timing is unavailable...` (`:37-44,173-188`). Only applicable retry/start statuses are tappable (`:186,203-206`). Playback failure is `Audio failed · tap Play to retry` (`:202`).

## Slide score and assessment state (shared with Full review)
- Heading Slide score or Presentation score; Refresh. Ring numeric score 0-100 + backend level Beginning/Emerging/Competent/Advanced, otherwise em dash or ellipsis/status (`PresentationScorePanel.tsx:12-30`; `presentationScoreDisplay.ts:7-18`).
- Current result shows summary, optional justification, Strengths, Weaknesses, Actionable improvements; each advice cites evidence. Evidence has label/quote and Open slide n, Listen to this interval, or `Listen to n cited intervals` (`PresentationScorePanel.tsx:34-55`). Do not invent criterion radar charts: this panel renders prose/evidence only.
- No overall target explains `An overall score needs one complete original recording. Each slide can show its selected original recording's score.` No slide target asks for exact original recording. Transcript required before scoring (`PresentationScorePanel.tsx:28-29`).
- Retry action appears for failure, uncertain prior request, dependency recovery, invalid evidence or controller notice; disabled busy/not-ready/unavailable/inactive/confirmation (`:20-31`). Inline retry charge confirmation: Retry anyway / Cancel (`:31`).
- Status set: Not graded; Score outdated; Profile retry needs confirmation; Slide context needs recovery; Retry needs confirmation; Waiting for AI capacity; Preparing slide context; Grading; Recording exceeds grading limits; Grading failed; Grading unavailable; Some slides graded; Incomplete recording; Insufficient evidence; Score evidence could not be verified (`presentationScore.ts:35-43`). Connection interruption retains scores and shows Reconnecting (`useRunPresentationScores.ts:50`).

## Selected-slide AI feedback (not same as numeric score)
- AI feedback heading; Refresh; status; verified finding cards (category, observation, suggestion). Details & evidence expands slide/speech quote and Listen at timestamp. Listen opens inline Feedback evidence card in recording tools and scrolls it into view (`SlideReviewSummary.tsx:37-62,65-76`; `ReviewScreen.tsx:49-54,120-121`).
- Optional Further Insight accordion reveals ILLUSTRATIVE IDEA text (`SlideReviewSummary.tsx:50-54`).
- Status set: preparing first feedback, first feedback could not start, new recording required, transcript pending, no speech insufficient evidence; queued/preparing slide context/preparing feedback/AI reviewing/verifying/waiting capacity; long-running and scheduled retry timing; outdated; profile failure; needs confirmation; unavailable; Looks good; Focus on these; partial/unverified/invalid/model error/insufficient evidence (`SlideReviewSummary.tsx:31-47`; `slideReview.ts:23-48`).
- Recovery is Update feedback / Retry feedback / Retry slide profiles depending state. Disabled while busy, dirty presentation settings, transcript not ready, unavailable or retry disallowed. Charge uncertainty inline Retry anyway / Cancel (`SlideReviewSummary.tsx:34-35,58-62`).

## Recording tools (inline Review; nested content can be scrolled)
- Missing local audio with downloadable source shows Download audio / Checking audio; errors shown. Recording tools / Hide recording tools toggles panel (`ReviewRecordingTools.tsx:78-97`).
- Expanded: transcription status; Upload recording / Retry transcription / Transcribe recording as appropriate; Refresh status; retry available time; pending permission/retry note; Original transcript · word playback toggle; Recording-wide suggestions; PDF offline tools toggle (`:61-66,82-96`).
- Feedback evidence card appears on cited finding/score interval: heading, observation, Speech/Slide quotes, Source recording timestamps, Play/Pause/Resume evidence, Close evidence. Invalid interval disables playback and explains retained original (`:44-51,68-76`).
- Original transcript words seek selected source from tapped timestamp onward when seekable and audio ready (`:53-66`).

## Recording-wide suggestions and slide descriptions
- Heading + distinction that these cover original recording. Load/Refresh suggestion status; Generate suggestions if no result; Retry/Regenerate suggestions or Update feedback if eligible; Retry slide descriptions if dependency. Disabled busy, consent prompt, unsaved description draft, unavailable or retry disallowed. Displays up to three suggestions with category+slide, observation, suggestion, description origin and quote, speech evidence (`TakePlayback.tsx:232-274`).
- Slide descriptions accordion; within it a per-slide expand button. Expanded description: Summary, Key ideas, Visual facts, uncertainty explanations and Edit description (`TakePlayback.tsx:278-315`).
- Edit draft: Summary/each key idea/each visual fact multiline fields (400 char labels); Mark uncertain/certain toggle; uncertainty text field if uncertain; Save description / Saving; Cancel edit. Conflict disables Save and adds Reload current version. Saving invalidates existing suggestions for explicit regeneration (`:289-328`).
- PDF offline tools: original PDF available, Download PDF / Checking PDF, or no downloadable PDF; errors (`TakePlayback.tsx:375-387`).

## Full review (normal screen)
- Header deck title + Full review/run label. Overall score ring; duration with over/under/on target and required/default/suggested; verified findings; fillers/min; WPM/pace (`FullReviewScreen.tsx:190-205`).
- Whole run header; note `Tap a section to hear it`; main Play/Pause; proportional segments per recorded slide tap play that slide; playback progress, current slide title and elapsed/total (`:180-228`).
- Scroll body: Presentation score panel; `assessed of recorded recorded slides assessed`; counts with findings / partial / analyzing / outdated / needs recovery / insufficient evidence / not analyzed; Refresh status; Transcript with slide badge at section beginnings, timed highlight/autoscroll; pending or no-speech empty state (`:238-251,308-320`).
- Bottom Slides score strip: numbered colored tiles with numeric score, ellipsis, stale refresh symbol or em dash; tap enters Review of that slide. Bottom down Back to review / Back to slides / Back from incoming context, plus Tap a slide to review it (`:253-281`).
- Hardware/back/down navigation returns Review if from Review, Rehearse if from Rehearse, otherwise Home. A slide opened from Full returns Full (`:66-76`).
- Missing audio: if all missing, note `Audio for this run isn't on this phone`; partial missing opens `Some run audio is missing` dialog with affected slides, Cancel / Play available audio. Changed recordings while dialog open abort with `Selected recordings changed. Start playback again.` Partial playback note counts missing slides (`:155-171,284`).
- Score audio evidence plays exact original recording intervals; missing original audio directs to slide review download (`:129-140`).

## Compare recordings (normal screen)
- Deck/slide-range title; `Whole presentation` or `Slide n` / n slides + `choose one recording`. New duration vs target, delta chips, side-by-side Keep current / Overwrite cards; default selected Keep current. Each card: duration, Fillers, Points, Pace, Opened with excerpt. Pending values ellipsis, Transcribing; silent Nothing said. New values colored against old where meaningful (`CompareScreen.tsx:31-49,68-98,103-115`).
- Green check round action label Keep current recording or Overwrite with new recording resolves choice then opens Full for first saved take, Review for later. System Back keeps current and returns Rehearse. No swipe navigation (`CompareScreen.tsx:52-63,118-120`). No two audio Play controls in comparison cards.

## Audience Q&A prep/recovery screen state
- Header Audience Q&A, writing status/audience. If no validated current questions, central status icon/message. Messages: unsynced presentation choices, recordings uploading/transcribing, outdated questions, missing audience, preparing questions, profile analysis recovery, generation failed/audio preserved, not ready (`QAScreen.tsx:98-102,288-290,378-387`).
- Contextual buttons: Edit time and audience -> Rehearse with setup sheet open; Review selected recordings -> Review of pending slide; Refresh status (disabled busy/inactive); Update questions or Retry questions if sources ready/no dirty settings/not busy/not active; record button disabled without question (`:382-395`).

## Q&A question/record/review/followup/saved states
- Ready question: header Question n of total · audience; panelist avatar initials/name; role; `Asked after slide n · topic`; large question text; tap to hear/stop TTS; MiniSlide preview with From slide n. Record microphone; Next and Back bottom hints; horizontal swipe previous/next, downward back -> Review (`QAScreen.tsx:210-253,264-267,288-345,373-396`).
- Countdown 3/2/1: ring + Tap to cancel, record tap cancels. Recording: stop button, Listening, elapsed time, live waveform, `60–90 seconds is typical` (followup `30–60`); prevents navigation during count/record (`:161-207,221-233,264-267,345,389-395`).
- Answer saved immediately then review: smaller Question; Saved audio duration chip plays/pause; Transcribing and reviewing your answer; error tap retry; verdict Answered / Partly answered / Too short; Did it answer?, Evidence, Clarify; timed transcript rows. Redo button rerecords same question (`:173-186,268-280,318-329,346-370,395`).
- Successful sufficiently long primary answer with follow-up shows follow-up card + Tap to answer / Answered tap to view. Follow-up ask displays original question as back control + larger followup, TTS; recording/review mirrors primary. Tap original returns main answer (`:318-337,359-365`).
- Saved Q&A button cycles archived sets and then current; archived title Saved Q&A; Next saved / Current Q&A top action; playback only (record button absent). Uses saved audience/questions/answers; no rerecord/retry answer action on archives (`:46-53,61-69,265,289-295,349,395`).
- Last question note `Last question · swipe down for your review`; otherwise `Swipe for the next question`; Next omitted at last (`:266-267,373`).
- Answer transcription consent modal Transcribe with ElevenLabs? Cancel / Continue; uncertain previous provider outcome modal Confirm retry, Cancel / Retry (`:399-405`).

## Recovery recording-details sheet
- Rehearse `Recording interrupted · tap to inspect` (with n of total when multiple) opens TakePlayback; actual caller is `RehearseScreen.tsx:522-523`, triggers at `:696-704`.
- Scrim/X closes; Recording Details, deck title, Slide n of count; Recording current/total time + progress; contextual Download audio; Recover recording when interrupted and locally playable; transcription status/retry/refresh; transcript corrections/original-word playback if present; Recording tools; PDF offline tools; notice (`TakePlayback.tsx:163-224`). Recovery yields compare or review through Rehearse callback (`RehearseScreen.tsx:434-444`).
- Critical fidelity: sheet has no generic main play/pause button rendered. Source code constructs native player and permits transcript-word seek or feedback-evidence playback, but recovery-only case typically exposes Recover recording, not an invented standalone Play button.

## Global dialogs overlay any screen
- AppShell Prompts: Transcribe with ElevenLabs? (saved audio+vocabulary through server to Scribe v2) / Retry may charge again; Continue / Cancel. Recording-wide AI suggestions disclosure `AI suggestions from [provider]?` / `Request again?`; Continue / Cancel (`AppShell.tsx:169-200`). These are source-implemented consent/retry UI, not a proposed flow.

## Statistics mapping
- Home: overall score ring, Last run relative day or No runs yet; total findings; duration; WPM/pace; live notice for pending, outdated, retry, partial, insufficient, not analyzed (`HomeFeedbackStats.tsx:27-42`). Ring hit target opens FullReview (`HomeScreen.tsx:260-263,308-311`).
- Slide Review: slide score, actual vs target, fillers, verified findings, times-per-slide bars (`ReviewScreen.tsx:101-113`).
- Full Review: overall score, duration vs target, findings, fillers/min, WPM/pace, assessment counts and score tiles (`FullReviewScreen.tsx:194-205,238-277`).
- No historical progress chart/weekly trend/calendar or export/share statistics control in these screens.
