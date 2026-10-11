# OutLoud Requirements & Specifications

Team 07 (치르치르), Software Development Principles and Practice, Seoul National University<br>
Version 2.0, 9 October 2026

## Table of Contents

1. [Document Revision History](#1-document-revision-history)
2. [Project Abstract](#2-project-abstract)
3. [Customer](#3-customer)
4. [Competitive Landscape](#4-competitive-landscape)
5. [Functional Requirements](#5-functional-requirements)
   - [5.1 Presentation management](#51-presentation-management)
   - [5.2 Recording and slide synchronization](#52-recording-and-slide-synchronization)
   - [5.3 Transcription and rehearsal playback](#53-transcription-and-rehearsal-playback)
   - [5.4 Slide-specific and audience feedback](#54-slide-specific-and-audience-feedback)
   - [5.5 Speaking delivery feedback](#55-speaking-delivery-feedback)
   - [5.6 Retry and comparison](#56-retry-and-comparison)
   - [5.7 History, data management and recovery](#57-history-data-management-and-recovery)
   - [5.8 Original team stories](#58-original-team-stories)
6. [Non-functional Requirements](#6-non-functional-requirements)
7. [User Interface Requirements](#7-user-interface-requirements)
   - [7.1 Navigation flow](#71-navigation-flow)
   - [7.2 Screen descriptions](#72-screen-descriptions)
8. [Optional Future Features](#8-optional-future-features)

## 1. Document Revision History

| Version | Date | Key changes |
| --- | --- | --- |
| 1.0 | 2026-09-28 | Initial specification: scope, eleven user stories with acceptance criteria, quality requirements and low-fidelity UI flows. |
| 2.0 | 2026-10-09 | Merged closely related stories into nine mandatory stories in seven functional groups, and added the team's stories on filler words, pauses and student knowledge levels. Added failure and recovery scenarios. Separated automatic transcription from requested AI feedback. Added a competitor comparison table. Replaced text wireframes with Figma screens and navigation flow diagrams. |

## 2. Project Abstract

OutLoud is an Android application that helps students, professionals, founders and educators rehearse presentations with their own PDF slides. A presenter imports a deck, optionally describes the intended audience, and records a rehearsal while moving through the slides. OutLoud connects the recording to the slides shown during practice, so the presenter can revisit each slide with its audio and transcript. After the presenter accepts a data disclosure, the recording is transcribed automatically. A separate summary of key ideas helps users review what they said without replacing their original words. On request, AI feedback points out possible inconsistencies between slides and speech, unclear explanations, and language that may be difficult for the stated audience. Each suggestion links to the relevant slide and recording interval, so users can judge the advice themselves. Delivery feedback covers speaking pace, time spent on each slide, filler words and pauses. Users can practice the full presentation or selected slides again, keep earlier attempts, and compare the same slide across attempts. Saved recordings stay available when analysis fails, so users can retry processing without recording again. OutLoud is for practice, not live presentations, and it does not fact-check claims against external sources.

## 3. Customer

**General audience:** people who prepare spoken presentations with a slide deck and rehearse alone on an Android phone before presenting to others. They want specific, slide-level advice and a quick way to practice weak parts again. The first release is English-first. Audience members do not use the app; the presenter describes them as context for feedback.

**Specific customer types:**

- **University students** preparing class presentations. They record a full practice run, find the slide where their explanation is weak, rehearse only that slide again, and compare the two attempts.
- **Business and technical presenters** explaining technical proposals to nontechnical clients. They describe the audience before rehearsing and review terms such as "p95 latency" that need a plain-language explanation.
- **Startup founders** rehearsing pitches with charts and a time limit. They check that spoken claims match the numbers on their slides and review how long they spend on each slide.
- **Professors and instructors** preparing lessons for students with limited background knowledge. They state the students' level and review explanations that assume too much prior knowledge.

**Example.** A student imports a three-slide deck and records a full rehearsal. During review, feedback on slide 2 notes that the spoken explanation does not make the chart's meaning clear and plays the related part of the recording. The student rehearses slide 2 again and compares the two attempts. If analysis fails, the saved recording stays available for playback and later processing.

**Core constraints:** Android phone, PDF input and English-first rehearsal. Transcription starts automatically after the presenter accepts the data disclosure; AI feedback is generated when the presenter requests it. No feedback is given in real time during a presentation.

**Outside the core product:** real-time coaching during a live presentation, fact-checking against external sources, any requirement to read every slide element aloud, PPTX input and export. Optional extensions are listed in [Section 8](#8-optional-future-features).

## 4. Competitive Landscape

The table compares OutLoud with a general AI assistant and two presentation-practice tools. Competitor entries come only from each provider's public help pages, checked on 2026-10-09.

**Legend.** O = documented by the provider. X = the provider's documentation states that it is not available. – = not found in the documentation we checked; the feature may exist. For OutLoud, O = required by this specification, Opt. = optional future feature, X = not planned.

| Capability | ChatGPT | Microsoft Speaker Coach | Yoodli | OutLoud |
| --- | :---: | :---: | :---: | :---: |
| Rehearse while presenting your own slides | – | O | O ¹ | O |
| Speaking pace feedback | – | O | – | O |
| Filler-word feedback | – | O | – | O |
| Detects when the speaker reads slide text aloud | – | O | – | X |
| Feedback on presentation content, not only delivery | O ² | O | O ³ | O |
| Rehearsal results saved for later review | – | X ⁴ | O | O |
| Feedback linked to a specific slide and moment in the recording | – | – | – | O |
| Feedback adapted to a described audience | – | – | – | O |
| Re-record only selected slides as a new attempt | – | – | – | O |
| Compare the same slide across attempts | – | – | – | O |
| Practice answering audience questions | – | – | O | Opt. |

¹ Learners can share their screen, such as presentation materials, while practicing.<br>
² Users can upload PDF or PPTX slides and audio files and ask for feedback in a conversation.<br>
³ Screensharing Goals score a shared screen against a rubric; Enterprise plan only.<br>
⁴ The rehearsal report disappears when it is closed unless the user takes a screenshot.

**How OutLoud differs.** Pace and filler-word feedback alone do not differentiate OutLoud; Speaker Coach already provides them. OutLoud's intended difference is the connected workflow: feedback tied to a specific slide and moment of the recording, focused practice of selected slides, and comparison of the same slide across attempts.

Sources: [Microsoft Speaker Coach](https://support.microsoft.com/en-us/powerpoint/rehearse-your-slide-show-with-speaker-coach), [Practice with Yoodli](https://support.yoodli.ai/en/articles/9550465-practice-with-yoodli), [Yoodli Screensharing Goals](https://support.yoodli.ai/en/articles/11591789-screensharing-goals), [Uploading files and audio to ChatGPT](https://help.openai.com/en/articles/8555545-uploading-files-and-audio-to-chatgpt).

## 5. Functional Requirements

The nine stories in this section describe the mandatory functionality of the final product. Each story uses the Connextra format. Each acceptance criterion uses Given–When–Then and is labeled **Positive** (expected success) or **Negative** (failure or input that is not allowed). Story IDs follow Version 1.0. The team will select and freeze the user acceptance test (UAT) stories by the end of Iteration 3.

| Functional group | Stories |
| --- | --- |
| 5.1 Presentation management | US-01 |
| 5.2 Recording and slide synchronization | US-02 |
| 5.3 Transcription and rehearsal playback | US-03 |
| 5.4 Slide-specific and audience feedback | US-05, US-07 |
| 5.5 Speaking delivery feedback | US-06 |
| 5.6 Retry and comparison | US-08 |
| 5.7 History, data management and recovery | US-10, US-11 |

### 5.1 Presentation management

#### US-01. Import and inspect slides

**As a** presenter, **I want** to import and navigate a PDF presentation, **so that** I can rehearse using my own slides.

- **AC-01a. Import a valid PDF (Positive)**
  - **Given** a valid three-page PDF
  - **When** I import it
  - **Then** the app shows three slides in their original order and lets me move between them.
- **AC-01b. Reject an unusable file (Negative)**
  - **Given** a corrupt, encrypted or otherwise unsupported PDF, or a file that is not a PDF
  - **When** I import it
  - **Then** the app explains the failure and lets me choose another file, without creating a deck that is ready to practice.
- **AC-01c. Cancel file selection (Negative)**
  - **Given** my presentation library is open
  - **When** I cancel the file picker
  - **Then** the library is unchanged.

### 5.2 Recording and slide synchronization

#### US-02. Record a slide-based rehearsal

**As a** presenter, **I want** to record my speech while changing slides, **so that** I can later review what I said on each slide.

- **AC-02a. Record repeated slide visits (Positive)**
  - **Given** a loaded deck and microphone permission
  - **When** I record while visiting slides 1, 2 and then 1 again, and press Stop
  - **Then** one saved attempt contains the audio and all three slide visits in order, each at its position in the recording.
- **AC-02b. Microphone permission denied (Negative)**
  - **Given** microphone permission is denied
  - **When** I select Start recording
  - **Then** recording does not start, and the app explains how to allow access or return to the deck.
- **AC-02c. Recording interrupted (Negative)**
  - **Given** a recording is interrupted, for example by a phone call or by the app closing
  - **When** I return to the app
  - **Then** the app identifies the interrupted attempt, keeps any recoverable audio, and does not show the attempt as a completed rehearsal.
- **AC-02d. Leave while recording (Negative)**
  - **Given** a recording is in progress
  - **When** I press Back
  - **Then** the app asks whether to stop and save the attempt or discard it, and does not discard audio without my confirmation.

### 5.3 Transcription and rehearsal playback

#### US-03. Review recordings, transcripts and key ideas

**As a** presenter, **I want** to replay each slide's recording with its transcript and a separate summary of key ideas, **so that** I can find the parts that need improvement without losing my original wording.

- **AC-03a. Play a transcript segment (Positive)**
  - **Given** a processed attempt with speech on slide 2
  - **When** I open slide 2 and select a transcript segment
  - **Then** the app displays that segment and plays its linked audio interval from that attempt.
- **AC-03b. Slide without recognized speech (Negative)**
  - **Given** a visited slide with no recognized speech
  - **When** I open its Transcript and Key ideas views
  - **Then** both views state that no speech was recognized, which the app distinguishes from a transcript that is unavailable; no summary or slide description is shown in its place, and any available audio still plays.
- **AC-03c. Repeated visits to one slide (Positive)**
  - **Given** an attempt in which I visited the same slide twice
  - **When** I select one of those visits during playback
  - **Then** the displayed slide and transcript follow that visit's position in the recording, not the other visit.
- **AC-03d. Separate key ideas (Positive)**
  - **Given** an analyzed slide
  - **When** I switch between Transcript and Key ideas
  - **Then** the recognized words remain unchanged, and the summary of what I said appears as a separately labeled AI-generated view.
- **AC-03e. Summary could not be generated (Negative)**
  - **Given** a slide with recognized speech whose summary could not be generated
  - **When** I open Key ideas
  - **Then** the app states that the summary is unavailable and keeps the transcript and audio available.

### 5.4 Slide-specific and audience feedback

#### US-05. Review evidence-linked content feedback

**As a** presenter, **I want** suggestions grounded in my slides and speech, **so that** I can review possible inconsistencies and improve unclear explanations.

- **AC-05a. Feedback for a selected slide, with evidence (Positive)**
  - **Given** a rehearsal with feedback available, in which slide 2 states "Revenue increased by 20%" and the recording says "Revenue decreased by 20%" about the same period
  - **When** I select slide 2 to review
  - **Then** the app displays slide 2's feedback: it identifies the possible mismatch, shows the slide text and the speech interval as evidence, explains the issue and suggests checking or correcting the explanation. Human review confirms whether the interpretation is correct.
- **AC-05b. Reject invalid evidence (Negative)**
  - **Given** a generated suggestion that refers to a slide that does not exist or to an audio interval outside the recording
  - **When** results are prepared for display
  - **Then** that suggestion is not shown as a valid evidence-linked suggestion.
- **AC-05c. Respect the practiced slides (Negative)**
  - **Given** a rehearsal of slides 2 and 3 only
  - **When** content feedback is generated
  - **Then** slides outside that selection are not flagged as missing explanations, and decorative or irrelevant slide elements need not be spoken aloud.

#### US-07. Adapt feedback to the audience's knowledge level

**As a** presenter, **I want** feedback on wording and explanations that may be hard for the audience I describe, such as nontechnical clients or students with limited background, **so that** I can explain my ideas at the right level.

- **AC-07a. Plain wording for nontechnical clients (Positive)**
  - **Given** the presenter selected the audience "nontechnical clients" and recorded a pitch that uses "p95 latency" without explaining it
  - **When** the presenter requests feedback
  - **Then** the app highlights the term, links to where it was said in the recording, and suggests clearer, plain-language wording. Human review assesses usefulness and correctness.
- **AC-07b. No audience described (Negative)**
  - **Given** no audience description or knowledge level was supplied
  - **When** I request feedback
  - **Then** regular feedback remains available, and the app neither invents an audience profile nor assumes a particular course prerequisite or student background.
- **AC-07c. Simpler explanation for students (Positive)**
  - **Given** the professor has specified the students' knowledge level and recorded a presentation containing an explanation that assumes more advanced knowledge
  - **When** the professor requests feedback
  - **Then** the app highlights that explanation and suggests a simpler explanation.

### 5.5 Speaking delivery feedback

#### US-06. Review pace, slide timing, filler words and pauses

**As a** presenter, **I want** to review my speaking pace, time per slide, filler words and pauses, **so that** I can identify sections to shorten and improve my delivery habits.

- **AC-06a. Pace and duration for one slide (Positive)**
  - **Given** a slide interval with 60 recognized words over 30 seconds
  - **When** I review its pace
  - **Then** the app shows an elapsed-time rate of 120 words per minute and a slide duration of 30 seconds.
- **AC-06b. Pace or pauses unavailable (Negative)**
  - **Given** no valid speech or an interval of zero duration
  - **When** I review statistics
  - **Then** pace is labeled unavailable instead of being shown as a normal score. Pause results state the detection rule used, and pauses that could not be measured are labeled unavailable.
- **AC-06c. Filler results unavailable (Negative)**
  - **Given** filler-word results are unavailable for a rehearsal, for example because detection failed
  - **When** I review delivery feedback
  - **Then** the filler category is labeled unavailable instead of reporting that no fillers occurred.
- **AC-06d. Total time for a revisited slide (Positive)**
  - **Given** slide 1 was visited for 10 seconds and later for 20 seconds
  - **When** I review time per slide
  - **Then** slide 1 shows a total of 30 seconds, and both visits remain available for review.
- **AC-06e. Flag filler words and pauses (Positive)**
  - **Given** the presenter has recorded a rehearsal containing filler words and pauses
  - **When** the presenter requests feedback
  - **Then** the app flags the sections containing filler words and pauses for review.

An unavailable label is an error state; it does not satisfy AC-06e. Repetition and false-start detection are optional and appear only after the detector passes the team's pilot check.

### 5.6 Retry and comparison

#### US-08. Practice selected slides again and compare attempts

**As a** presenter, **I want** to rehearse the whole deck or selected slides again as a new attempt and compare the same slide across attempts, **so that** I can improve weak sections and judge whether my revision helped.

- **AC-08a. Retry one slide (Positive)**
  - **Given** attempt A covers slides 1 to 3
  - **When** I select only slide 2 and complete another rehearsal
  - **Then** a separate attempt B contains slide 2 with new audio and results, and attempt A's audio, transcript and feedback remain unchanged.
- **AC-08b. No slide selected (Negative)**
  - **Given** no slides are selected
  - **When** I open retry setup
  - **Then** Start remains unavailable until I select at least one slide or the whole deck.
- **AC-08c. Compare slide 2 in two attempts (Positive)**
  - **Given** full attempt A and selected-slide attempt B both include slide 2 of the same deck
  - **When** I compare that slide
  - **Then** both attempts' audio, transcripts and feedback are available with clear attempt labels.
- **AC-08d. No shared slide (Negative)**
  - **Given** two attempts that do not share a slide from the same uploaded deck
  - **When** I select comparison
  - **Then** the app explains that no comparable slide is available and does not pair unrelated slide numbers.
- **AC-08e. Feedback missing for one attempt (Negative)**
  - **Given** one of two compatible attempts has no completed feedback
  - **When** I compare them
  - **Then** the available audio and text remain reviewable, and the missing feedback is labeled.

### 5.7 History, data management and recovery

#### US-10. Reopen saved attempts and recover analysis

**As a** presenter, **I want** saved rehearsals to reopen and failed analysis to be retryable, **so that** a network or model failure does not require another recording.

- **AC-10a. Reopen a saved attempt (Positive)**
  - **Given** a saved attempt
  - **When** I close and reopen the app and select it
  - **Then** its available audio, transcript and results reopen with the correct processing status.
- **AC-10b. Retry failed analysis (Positive)**
  - **Given** saved audio and a failed analysis
  - **When** I select Retry analysis after the service recovers
  - **Then** analysis uses the same recording and preserves earlier attempts, and repeating the request does not create duplicate rehearsal attempts.
- **AC-10c. Later stage fails (Negative)**
  - **Given** a history refresh or a later analysis stage fails
  - **When** I return to review
  - **Then** previously saved material remains available, the failure is explained, and an eligible recovery action is offered.

#### US-11. Delete rehearsal data

**As a** presenter, **I want** to delete an attempt or deck I no longer need, **so that** I can control the rehearsal data retained by the app.

- **AC-11a. Cancel or confirm deletion (Positive)**
  - **Given** a deletion confirmation that names the selected attempt
  - **When** I cancel, **Then** nothing is deleted.
  - **When** I confirm, **Then** its app-owned audio and derived data are removed, and the attempt can no longer be reopened.
- **AC-11b. Delete a deck with several attempts (Positive)**
  - **Given** a deck with several attempts
  - **When** I request deck deletion
  - **Then** the confirmation lists the attempts that will be deleted, and other decks and their attempts remain intact.
- **AC-11c. Deletion cannot finish (Negative)**
  - **Given** a deletion that cannot finish
  - **When** I return to history
  - **Then** the app reports the incomplete deletion and offers recovery, without claiming that all affected data was removed.

### 5.8 Original team stories

The team's user-story exercise produced the four stories below. Their original wording and acceptance criteria are kept here, and each is tested by the criterion in the last column.

| Author | Original story | Original acceptance criterion | Tested by |
| --- | --- | --- | --- |
| 최재원 (Jaewon Choi) | As a student preparing a presentation, I want to review feedback on individual slides from my rehearsal, so that I can focus my practice on the parts that need improvement. | Given the student has a recorded rehearsal with feedback available, When the student selects a slide to review, Then the app displays feedback for that slide. | US-05, AC-05a |
| 박서연 (Seoyeon Park) | As a business presenter, I want feedback on whether my pitch uses language appropriate for nontechnical clients, so that I can explain my ideas more clearly. | Given the presenter has selected a nontechnical audience and recorded a pitch containing potentially confusing language, When the presenter requests feedback, Then the app highlights that language and suggests clearer wording. | US-07, AC-07a |
| 현주영 (Juyeong Hyeon) | As a presenter, I want to identify filler words and pauses in my rehearsal, so that I can review my speaking habits and improve my delivery. | Given the presenter has recorded a rehearsal containing filler words and pauses, When the presenter requests feedback, Then the app flags the sections containing filler words and pauses for review. | US-06, AC-06e |
| 전인준 (Injoon Jeon) | As a professor, I want feedback on explanations that may be difficult for my students, so that I can make complex topics easier to follow. | Given the professor has specified the students' knowledge level and recorded a presentation containing an explanation that assumes more advanced knowledge, When the professor requests feedback, Then the app highlights that explanation and suggests a simpler explanation. | US-07, AC-07c |

## 6. Non-functional Requirements

Each requirement below states testable behavior and how the team will verify it. Numerical targets will be set later; the table at the end of this section lists the measures that need a team-approved value or pilot data.

- **NFR-01. Data integrity:** A new attempt never overwrites an earlier attempt. Every evidence link resolves to the correct deck, slide, attempt and a valid time interval within that recording.
  *Verification:* compare stored attempts before and after a retry; test invalid references and repeated slide visits.
- **NFR-02. Responsiveness:** Recording and slide navigation remain usable without waiting for transcription or feedback. Long-running processing shows its current status and a failure or retry state.
  *Verification:* rehearse with a slow or unavailable network on Galaxy S22 and S23; measure input response and processing time separately.
- **NFR-03. AI quality and transparency:** Users can tell transcripts, AI summaries, measured statistics and suggestions apart. Uncertain advice is phrased as a prompt to review. A category that could not be analyzed is shown as unavailable, never as zero issues.
  *Verification:* human review of clean, contradictory, noisy and ambiguous examples; report missed issues and false warnings with their totals.
- **NFR-04. Recovery:** Saved audio survives analysis failure. Retries do not create duplicate attempts or duplicate active analysis jobs. Interrupted recordings are marked as interrupted, not as complete.
  *Verification:* interrupt uploads and analysis, send duplicate requests, restart the app, and check saved material and recovery actions.
- **NFR-05. Privacy:** The app explains what rehearsal data is uploaded, lets users cancel, and allows deletion of saved rehearsal data.
  *Verification:* cancel an upload and a feedback request, then confirm that deleting a rehearsal removes its app-owned audio and results.
- **NFR-06. Compatibility, usability and accessibility:** The agreed Android build runs on Galaxy S22 and S23. Recording, saving, processing and failure states look different from each other. Screens remain usable with large text and with TalkBack.
  *Verification:* complete import, recording, review and recovery tasks on both devices, including permission denial, long text and TalkBack navigation. The minimum Android version will be confirmed during build validation.
- **NFR-07. Cost and maintainability:** Reopening saved results does not repeat paid analysis. Each processing run records the model version, duration, failed stage and cost where available. Retries reuse successful intermediate results.
  *Verification:* compare provider requests during replay, refresh and retry; produce a pilot report per rehearsal and stage.

**Numerical targets awaiting team approval or pilot data**

| Measure | How it will be measured | Status |
| --- | --- | --- |
| Slide-change response during recording | Time from tapping Next to the next slide appearing, on Galaxy S22/S23 | Team to approve a target |
| Save time after Stop | Time from Stop to the saved-session state | Team to approve a target |
| Processing time | Time from upload to completed transcript, and from Generate feedback to completed feedback, per minute of audio | Set from pilot results |
| Transcription quality | Word error rate on annotated English sample rehearsals | Set from pilot results |
| Feedback quality | Share of suggestions that human reviewers rate correct and useful | Set from pilot results |
| Cost per rehearsal | Provider cost per rehearsal minute | Set from pilot results |

**Provisional limits.** The current design uses 20 MiB per PDF, 10 slides per rehearsal, 10 minutes per recording and 500 characters of audience text. These are provisional implementation constraints, not product requirements, and may change.

## 7. User Interface Requirements

The wireframes come from the team's [OutLoud Figma file](https://www.figma.com/design/e8pS6NF8Jqwjnj3QWkDUKl?node-id=2-2) and show the intended interface with sample content. Screen IDs (S01, P02, ...) match the Figma frames.

### 7.1 Navigation flow

Figures 1 to 3 show how users move between screens. Arrow labels name the user action or system event. Solid arrows are normal actions. Dashed arrows and boxes are failures or input that is not allowed. Rounded boxes mark where a figure continues in another figure.

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/flow-1-record.png" width="760" alt="Figure 1. Navigation flow for importing a PDF, setting up and recording a rehearsal, including import errors, unsupported decks, denied microphone access, leaving during recording, interrupted recordings and the transcription disclosure."></p>

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/flow-2-review.png" width="760" alt="Figure 2. Navigation flow for reviewing a rehearsal, requesting AI feedback, recovering from processing failures and practicing selected slides again."></p>

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/flow-3-history.png" width="760" alt="Figure 3. Navigation flow for practice history, same-slide comparison and deletion, including failure states."></p>

### 7.2 Screen descriptions

#### Home and practice setup (S01, S04)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s01-home.png" width="270" alt="S01 Home with Import PDF, a recent presentation and navigation tabs"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s04-practice-setup.png" width="270" alt="S04 Practice setup with slide preview, audience field and Start rehearsal"></p>

- **Purpose:** Home (S01) lists recent presentations and starts an import. Practice setup (S04) previews the deck and collects optional audience context.
- **Input:** Import PDF opens the system file picker. In setup, Previous and Next move through the slide preview, and the audience field accepts free text such as "students new to this topic" or a knowledge level.
- **Transitions:** Choosing a valid PDF opens setup. Open slides opens setup for a saved deck. Review latest rehearsal opens review (S07). Practice opens practice history (S03). Start rehearsal opens the ready-to-record state; it does not start the microphone.
- **Errors and input not allowed:** Canceling the picker leaves the library unchanged. An unreadable or non-PDF file shows the reason and allows another choice. Import buttons are disabled while an import is running. Start rehearsal is unavailable while the preview is loading or failed, or when the deck cannot be rehearsed. Previous and Next are disabled at the first and last slide. An empty library explains how to import a presentation. Home shows the current file size and slide limits.

#### Recording (S05, S05P)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s05-recording.png" width="270" alt="S05 Recording in progress with timer, slide 2 of 3, Previous and Next slide and Stop recording"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s05p-microphone-denied.png" width="270" alt="S05P Microphone denied: no recording has started and a message asks the user to allow access"></p>

- **Purpose:** Record the rehearsal while the presenter moves through the slides (S05). S05P is the state after microphone permission is denied.
- **Input:** Start recording, Previous slide, Next slide and Stop recording.
- **Transitions:** Start recording asks Android for microphone permission if needed and then starts the timer and recording indicator. Previous and Next change slides; returning to an earlier slide is allowed, and every visit is kept in order. Stop recording saves the attempt and shows the saved-session state, where Open review continues to review and Record again starts a new attempt without replacing the saved one. Back asks whether to stop and save or discard.
- **Errors and input not allowed:** If permission is denied, no recording starts (S05P) and the app explains how to allow access or return to the deck. Navigation cannot move past the first or last slide. Start, Stop and slide navigation are disabled while recording starts or saves. If recording is interrupted or saving fails, the app keeps recoverable audio, marks the attempt as interrupted, and never shows a failed save as successful.

#### Review overview, processing and no speech (S07, S07P, S07N)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s07-review-overview.png" width="200" alt="S07 Review overview with duration, words per minute, time on each slide and Generate feedback"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s07p-processing.png" width="200" alt="S07P Processing with a saved partial transcript and Generate feedback unavailable"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s07n-no-speech.png" width="200" alt="S07N No speech detected, with the saved recording still playable"></p>

- **Purpose:** Overview (S07) summarizes one attempt: duration, speaking rate, time on each slide, processing status and the entry point for AI feedback. S07P and S07N show the processing and no-speech states.
- **Input:** The Overview, Slides and Transcript tabs; Refresh analysis; Generate feedback; the shared player (Play or Pause, -5 s, +5 s).
- **Transitions:** Before the first upload, a transcription disclosure explains which data is sent for external processing. Continue uploads the recording and starts transcription automatically; Cancel keeps the attempt on the device for audio playback. Generate feedback shows a feedback disclosure (S10F); Continue requests AI feedback and opens the feedback result (S07F) when it is ready, and Cancel sends no request. Switching tabs keeps the playback position. Leaving review pauses audio, and returning does not start it automatically.
- **Errors and input not allowed:** While processing (S07P), partial results are labeled and Generate feedback is unavailable. When no speech is recognized (S07N), the app says so and keeps the recording playable; it does not create a transcript or feedback. Failed or unavailable measures are labeled, never shown as normal scores. Reopening saved results does not repeat paid analysis.

#### Slide feedback (S07F)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s07f-slide-feedback.png" width="300" alt="S07F Evidence-linked coaching: a content suggestion for slide 2 showing the slide text, the spoken sentence with its time range, Play evidence, why to review it and what to try next, followed by an audience suggestion about p95 latency and Practice again"></p>

- **Purpose:** Show AI feedback for the rehearsal, one suggestion per issue, each tied to a slide and a moment in the recording. This is the view that connects feedback to evidence.
- **Input:** Play evidence, Open slide, View transcript, View suggestion, Practice again and the shared player.
- **Transitions:** Each suggestion shows its type (content or audience), the slide and visit, the slide evidence, what the presenter said with its time range, why it is worth reviewing and what to try next. Play evidence plays exactly that interval from the same attempt and highlights the matching transcript text. Open slide opens slide review (S08) at that visit; View transcript opens the transcript (S09) at the same interval. Practice again opens selected-slide practice (P02). Back returns to the overview and pauses audio.
- **Errors and input not allowed:** A suggestion whose slide or time range is invalid is not shown as having valid evidence. While feedback is processing, the app shows S07P; if no speech was recognized, S07N; if audio is missing or analysis failed, recovery (S12). When audio is unavailable, Play evidence is disabled but the written evidence stays readable. Without an audience description, regular feedback is shown without an invented audience profile.

#### Slide and transcript review (S08, S09)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s08-slide-review.png" width="270" alt="S08 Slide review showing slide 2, visit 2, time by slide, visit navigation and slide description"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s09-transcript.png" width="270" alt="S09 Transcript with timed segments and the shared player"></p>

- **Purpose:** Inspect what happened on each slide (S08) and read the recognized speech (S09).
- **Input:** Previous visit, Next visit, a transcript segment, the Transcript and Key ideas views, and the shared player.
- **Transitions:** A slide can have several visits; the selected visit shows its time range, and Previous or Next visit follows recording order. Time by slide totals all visits to that slide. Selecting a transcript segment plays that segment's audio interval. Key ideas shows a separately labeled AI summary of what the presenter said. Delivery feedback shows pace per slide and flags filler words and pauses with links to the audio. The slide description explains the slide's content and is separate from the key ideas summary.
- **Errors and input not allowed:** A missing PDF does not block available audio or transcript. Playback controls are disabled when audio is unavailable. Partial, failed and no-speech results have different labels. An unavailable summary or delivery category is labeled unavailable.

#### Practice history and recovery (S03, S12)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s03-practice-history.png" width="270" alt="S03 Practice history with attempts grouped by presentation"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/s12-recovery.png" width="270" alt="S12 Recovery with options to recover audio, upload, download for offline review, refresh and retry analysis"></p>

- **Purpose:** Practice history (S03) lists saved attempts grouped by presentation, newest first. Recovery (S12) appears in review when audio, upload or analysis needs attention.
- **Input:** Refresh history, Open saved rehearsal, Review earlier rehearsal; in recovery: Recover playable audio, Upload recording, Download audio or PDF for offline review, Refresh and Retry analysis.
- **Transitions:** Opening an attempt shows review with its saved status. Retry analysis reprocesses the same recording and keeps the same attempt. Downloads make saved material available without a connection; transcription and feedback still need a connection.
- **Errors and input not allowed:** An empty history explains how to record. A failed refresh keeps the cached list and shows a notice. Retry analysis is unavailable while a retry is already running or during a cooldown, and the app shows when it can be retried.

#### Practice selected slides and compare attempts (P02, P03)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/p02-selected-slide-retry.png" width="270" alt="P02 Practice selected slides with All slides, a slide checklist and Record new attempt"> &nbsp; <img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/p03-compare-slide.png" width="270" alt="P03 Compare slide 2 across attempts A and B with Listen buttons"></p>

- **Purpose:** Practice the whole deck or chosen slides again as a new attempt (P02), and compare the same slide across two attempts (P03).
- **Input:** All slides or individual slide checkboxes, Record new attempt and Cancel; in comparison, the two attempts, Listen to A, Listen to B and Back to rehearsals.
- **Transitions:** Record new attempt opens the ready-to-record state for the chosen slides; the new recording becomes a separate attempt. Comparison shows each attempt's audio, transcript and feedback for the shared slide, with clear attempt labels.
- **Errors and input not allowed:** Record new attempt is unavailable until at least one slide or All slides is selected. Cancel leaves all attempts unchanged. If the chosen attempts share no slide from the same deck, the app explains that nothing can be compared. Missing feedback for one attempt is labeled while its audio and transcript stay available.

#### Delete data (P04)

<p align="center"><img src="https://raw.githubusercontent.com/wiki/snuhcs-course/swpp-2026-project-team-07/assets/requirements/p04-delete-data.png" width="270" alt="P04 Delete confirmation naming the rehearsal and the data affected, with Cancel and Confirm deletion"></p>

- **Purpose:** Confirm deletion of an attempt or a whole deck.
- **Input:** Cancel or Confirm deletion.
- **Transitions:** The confirmation names the attempt or deck and the data affected (audio, transcript, timing and feedback); deck deletion also lists its attempts. Cancel returns to history with nothing deleted. Confirm removes the app-owned data and returns to history.
- **Errors and input not allowed:** If deletion cannot finish, history reports the incomplete deletion and offers recovery instead of claiming success.

## 8. Optional Future Features

The features below are outside the mandatory scope. The team may adopt them later; their criteria are proposals.

**US-13. Correct slide descriptions.** As a presenter, I want to inspect and correct saved slide descriptions, so that coaching uses slide information I can review.

- **AC-13a (proposed).** Given a saved description, When I save a valid correction, Then the slide keeps its identity and feedback based on the old description is marked out of date.
- **AC-13b (proposed).** Given an unsaved, invalid or conflicting edit, When I cancel or try to save it, Then canceling keeps the saved version, and an unsuccessful save explains how to correct or reload the draft.

**US-17. Audience questions.** As a presenter, I want to practice questions about my presentation, so that I can prepare for audience discussion.

- **AC-17a (proposed).** Given a saved presentation with usable content, When I start question practice, Then the questions relate to that presentation and are labeled AI-generated; missing context is explained, not invented.

**US-18. Script attachment.** As a presenter, I want to attach a script to a presentation, so that I can consult my intended explanation while preparing.

- **AC-18a (proposed).** Given a selected presentation, When I attach a supported script or cancel the selection, Then a successful attachment stays separate from the transcript, and canceling or unsupported input leaves existing rehearsal data unchanged.

**US-19. Team sharing.** As a presenter working in a team, I want to share rehearsal material with selected teammates, so that we can coordinate improvements.

- **AC-19a (proposed).** Given an authenticated owner and a selected recipient, When I confirm sharing, Then only the selected material becomes accessible to that recipient, and users without permission cannot access it.

**US-20. Korean rehearsal support.** As a Korean-speaking presenter, I want to review Korean rehearsal speech, so that I can practice in the language of my presentation.

- **AC-20a (proposed).** Given a Korean rehearsal, When I review completed analysis, Then the recognized Korean text is readable and each delivery measure is labeled by what it measures. Quality targets require evaluation before support is claimed.
