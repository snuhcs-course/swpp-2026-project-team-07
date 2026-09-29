# Iteration 1: teammate work division

Use three feature owners and one integration owner if your team has four people in total. I recommend that you own integration because you have reviewed the scaffold and its contracts. Assign the other roles by experience: Android/UI for PDF and recording; Python/API work for Whisper. These are recommendations, not assignments inferred from the submitted schedule. Placeholder hours are deliberately omitted.

## Ownership at a glance

| Owner | Branch | Responsibility | Main implementation files |
| --- | --- | --- | --- |
| Teammate A | `feature/pdf-viewer` | PDF import, preparation, and real slide display | `mobile/src/features/pdf/`, `backend/rehearsals/services/pdf.py` |
| Teammate B | `feature/recording-tracking` | Real microphone recording and slide-event capture | `mobile/src/features/recording/` |
| Teammate C | `feature/whisper-alignment` | Hosted Whisper, timestamp normalization, slide matching, result UI | `mobile/src/features/transcription/`, `backend/rehearsals/services/transcription.py`, `backend/rehearsals/services/alignment.py` |
| You / integration owner | `feature/prototype-integration` | Upload/result endpoints, database/file persistence, Celery orchestration, initial Gemini feedback, end-to-end demo | `backend/rehearsals/views.py`, `urls.py`, `serializers.py`, `models.py`, `tasks.py`, `services/feedback.py` |

Each owner also writes meaningful tests for their feature. The integration owner coordinates shared files; this is not a rule that prevents anyone else from contributing to them.

## A. PDF import and slide viewer

Implement:

1. Use the document picker to select a PDF; return `null` on cancellation and show a useful error for invalid input.
2. Keep a readable file URI long enough to upload it. Call the agreed `POST /api/decks/` endpoint.
3. Implement `prepare_slides` on the backend: ordered page images and extracted text, including a defined behavior for pages without extractable text.
4. Replace demo slide content with real images and identifiers returned by the API. Preserve page order and previous/next boundaries.
5. Pass the real deck and current page into the rehearsal flow in coordination with the recording owner. Keep optional audience context.

Hand over: a real `Deck` and ordered `Slide[]`, with stable deck ID, zero-based indexes, usable image URLs, and extracted text. Agree with the integration owner on how generated files are persisted and served.

Done when: a 3–5-page PDF can be imported and every page displayed in order; cancellation, an invalid file, and a failed upload are handled. Include one visual/chart-heavy page and one text page in the demonstration. Importing a PDF must not silently display the sample deck.

## B. Recording and slide tracking

Implement:

1. `RecordingService.start`, `onSlideChanged`, `stop`, and `cancel` using real microphone capture.
2. Permission handling and an explicit response to interruption/backgrounding; do not add pause/resume until its time-base policy is agreed.
3. Save the audio to a durable local file and create a distinct attempt ID per recording.
4. Capture the initial visible page at audio time `0`, followed by every forward/backward slide change on the same audio timeline.
5. Connect the rehearsal controls and elapsed display to the recorder's actual state. Make slide navigation use the real deck, not a fixed three-slide count.

Hand over: `LocalRecording` containing audio URI, attempt/deck IDs, duration, audience, and chronological `slide_events`. Agree on audio/container format with the Whisper owner before implementing uploads. The recording owner returns this object; the transcription owner's mobile service submits it.

Done when: a short recording is audibly playable and a sequence such as slide 1 → 2 → 1 → 3 produces matching events. Check permission denial, cancellation, repeated visits, duration, and interruption behavior. A working timer alone is not completion evidence.

## C. Whisper and slide alignment

Implement:

1. The mobile `TranscriptionService`: upload `LocalRecording`, request processing, poll results, and expose failure/retry state. Coordinate upload handlers with the integration owner.
2. The backend `transcribe` adapter for hosted `whisper-1`, using the agreed timestamped output and backend-only credentials.
3. Normalize provider times into integer milliseconds. Preserve the raw provider response for evaluation and avoid re-transcribing an existing successful attempt unnecessarily.
4. Implement `align_words` against the recorded slide events, including repeated/backward visits and exact-boundary words.
5. Replace the result screen's samples with real transcript/status/error data. Coordinate playback and per-slide transcript presentation with the recording owner.

Hand over: normalized words, preserved transcript, and a documented alignment result that the integration owner can feed into feedback generation. Agree on that internal alignment shape before wiring `tasks.py`.

Done when: a real short recording produces readable words and plausible timestamps, manually checked against its audio. Check slide-boundary words, a repeated slide, an empty/silent recording, and provider failure. Processing failure must retain the original audio. Do not claim filler/repetition detection without evaluating it on actual recordings.

## D. Integration, backend, and initial feedback

Implement early:

1. Replace the 501 upload/result handlers with validated file storage, model records, and the agreed response shapes. PDF processing is supplied by A; audio/transcription clients are supplied by C.
2. Serve prepared slide images to the emulator. Validate deck existence, page bounds, recording metadata, and conflicting attempt IDs.
3. Queue processing only after the attempt is saved. Make duplicate processing requests safe and update `pending`, `processing`, `completed`, and `failed` consistently.
4. Wire `process_attempt`: load stored audio → call C's transcription/alignment → call feedback → save results. Keep provider errors safe for the app and preserve source files.

Then implement the remaining Iteration 1 feedback scope:

5. Connect the initial Gemini adapter to prepared slide images/text, matching speech, bounded context, and optional audience.
6. Validate feedback structure and slide/time references before returning it. Keep suggestions separate from the verbatim transcript.
7. Run the full workflow with the other owners on one shared 3–5-slide pilot. Include a backward slide visit and manually check selected word/slide/feedback evidence.

Done when: a real PDF → recording → transcript → slide matching → initial feedback flows through the Android app, Django, storage, and worker. Retrying a failed processing attempt must preserve its identity/audio. Keep saved-attempt browsing and comparison screens for later iterations.

This owner has the most cross-feature dependencies. Merge the API/storage work first in a small PR, then worker wiring, then Gemini feedback. Ask the PDF owner to help with Gemini's image/text input once PDF preparation is stable; keep one person responsible for the final integration.

## Start in parallel without waiting for completed features

First, everyone reads [api-contract.md](api-contract.md) and [iteration-1-handoff.md](iteration-1-handoff.md). Agree on audio format, audio-start timing, slide-image access, and the internal alignment result. Coordinate any shared-contract changes before coding against them.

- A can build PDF preparation and the viewer using an explicitly labeled local response fixture while the endpoint is being wired.
- B can implement real recording against the sample slide deck, then accept A's real deck data.
- C can implement transcription with a short consented test audio file and alignment with synthetic event lists. Provider calls require backend credentials; mocked tests can run without them.
- You can implement persistence, route validation, and task state transitions using mocked adapters, then replace those with the feature implementations.

Fixtures and mocks help development; they must stay distinguishable from real imports, recordings, and provider results.

## Shared-file and review rules

- Coordinate edits to `mobile/src/contracts/index.ts`, backend models/migrations, route registration, `app.json`, and dependency manifests/lockfiles with the integration owner.
- A owns PDF preparation; C owns Whisper/alignment; the integration owner owns endpoint wiring and `tasks.py`. This prevents three branches from replacing the same handler file independently.
- Suggested review pairs: A ↔ B for Android flow, C ↔ integration owner for API/worker behavior. Review across those pairs for the final end-to-end pilot.
- Each feature PR includes what changed, test commands/results, Android evidence where relevant, and known limitations. Follow the team's review/testing agreement before pushing.

## Git commands

Before the scaffold PR is merged, clone its published branch and create your own branch from it:

```sh
git clone --branch codex/iteration-1-scaffold https://github.com/snuhcs-course/swpp-2026-project-team-07.git
cd swpp-2026-project-team-07
git switch -c feature/pdf-viewer
```

Use your assigned branch name instead of `feature/pdf-viewer`. Do not commit feature work onto the shared scaffold branch. Open feature PRs against the scaffold branch while it remains the integration base, or wait to open them until the scaffold is merged.

After the scaffold is merged, new branches start from `main`:

```sh
git switch main
git pull --ff-only origin main
git switch -c feature/pdf-viewer
```

If you started before the scaffold merged, coordinate the base change with the integration owner so a feature PR does not duplicate the scaffold changes (especially after a squash merge).

After implementing and checking your feature:

```sh
git add <your-changed-files>
git commit -m "Implement PDF import and slide viewing"
git push -u origin feature/pdf-viewer
```

Open a pull request to the agreed base. Keep `.env`, provider keys, recordings, generated `mobile/android`, and local dependencies out of Git.

## If there are only three people in total

Keep A on PDF/viewer and B on recording/tracking; combine C and the integration lead as the third role. This is a heavier assignment, so A takes the initial Gemini slide-image adapter after PDF preparation is stable, and B helps with upload/playback integration after capture works. The third person retains ownership of task orchestration, shared contracts, and the final demo. Avoid leaving integration as an unassigned task for the end.
