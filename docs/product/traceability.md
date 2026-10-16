# Product traceability

**Status:** Current Iteration 2 map. This document connects the canonical
[requirements](requirements-and-specifications.md) to implementation and evidence; it
does not replace acceptance testing.

| Requirement area | Current implementation source | Verification/evidence status |
| --- | --- | --- |
| PDF import and slide preparation (US-01) | `mobile/src/features/pdf/`, `backend/rehearsals/views.py`, `backend/rehearsals/services/pdf.py` | Backend and mobile checks exist; physical-device and final acceptance results belong in Iteration 2 Testing Documentation. |
| Recording and slide timeline (US-02) | `mobile/src/features/recording/`, `mobile/src/screens/RehearseScreen.tsx`, `backend/rehearsals/models.py` | Local capture and durable upload paths exist; device coverage remains a team-owned test decision. |
| Transcript, alignment and playback (US-03) | `backend/rehearsals/services/transcription.py`, `backend/rehearsals/services/alignment.py`, `mobile/src/features/transcription/`, `mobile/src/screens/TakePlayback.tsx` | Dated evidence is under [`../evidence/iteration-2/transcription/`](../evidence/iteration-2/transcription/). |
| Evidence-linked coaching (US-05, US-07) | `backend/rehearsals/services/slide_review.py`, `backend/rehearsals/services/coaching.py`, `mobile/src/features/feedback/` | Policy and phase evidence is under [`../evidence/iteration-2/ai-feedback/`](../evidence/iteration-2/ai-feedback/). |
| Delivery review (US-06) | Saved visit/word metrics plus feedback categories in backend services and mobile review models | The current UI distinguishes measured values from AI suggestions; final coverage targets remain unset. |
| Retry, history and comparison (US-08, US-10) | `mobile/src/screens/HomeScreen.tsx`, `CompareScreen.tsx`, `TakePlayback.tsx`, and durable processing revisions in backend models/services | Recovery paths have automated checks; final device and acceptance coverage remains unset. |
| Deletion (US-11) | Specified but not established as complete by the current source review | Must not be marked implemented without code and test evidence. |
| Audience Q&A (US-17) | Experimental `mobile/src/features/qa/` and backend Q&A services/routes | Optional Iteration 3 feature; excluded from the Iteration 2 mandatory core. |

## Scope rules

- The [API contract](../architecture/api-contract.md) is the wire-level authority.
- Feature references explain the active implementation; dated test details live under
  `docs/evidence/iteration-2/`.
- Branch names, plans and experimental code do not establish completion or team
  approval.
- Testing Documentation is intentionally not created until the team confirms named
  component owners and predeclared coverage targets.
