# Iteration 5 Kickoff

2026-11-19 · Iteration 5

**Created:** 2026-11-19\
**Updated:** Not recorded

#### Participants and objective

- **Time / location:** Zoom. Time not recorded.
- **Participants:** Injoon, Jaewon (Jay) and Seoyeon are identifiable in the transcript. Full attendance was not recorded.
- **Objective:** Confirm the baseline for Iteration 5, coordinate the Iteration 4 handoff, and prepare for alpha testing and UAT Cycle 2.

#### Agenda

- Integration of demo v10 and the Korean UI and feedback changes.
- Iteration 4 submission and ONE store registration proof.
- Alpha pre-survey, in-class scenarios and UAT Cycle 2.

#### Notes

- The team confirmed that the demo v10 UI and AI feedback had merged into `main`. [PR #60](https://github.com/snuhcs-course/swpp-2026-project-team-07/pull/60)
- A team member reported that an English rehearsal produced Korean feedback with its evidence quotes still in English. The team discussed preserving those quotes when the feedback language changes.
- Alpha testers should bring a PDF for a topic they know. The team estimated 5–10 minutes for setup, ending when the tester has configured the rehearsal and can see slide cues and the recording control. The team entered 45 minutes as a provisional estimate for the five scenarios. The OpenRouter cost estimate was still open.
- The team selected five alpha scenarios covering recording while advancing slides, replay with a slide-aligned transcript, replaying the moment cited by feedback, using per-slide scores to identify where to focus, and audience-specific Q&A. PDF import is part of setup. Detailed scenario steps remained to be written.
- Injoon reported that the README update was in progress and identified the testing documentation as needing an update. The transcript did not capture a full round of individual status updates.

#### Decisions

| Issue | Resolution / agreed next step |
| --- | --- |
| UI integration | Start from the updated `main`. Jaewon will open one PR for the UI changes, then Seoyeon will add the Korean changes to the same PR. |
| Korean and English support | The team favored one app with an English/Korean choice available from the first screen. The chosen language should control the UI and feedback, while users can rehearse in a different language. How the app should use the device language remained open. |
| Iteration 4 submission | If the redesign is still pending, submit the current baseline and carry the redesign into Iteration 5 for alpha testing. November 20 at 15:00 KST was proposed as an internal cutoff. |
| Alpha pre-survey | Submit one response for the team. Use the five selected scenarios and refine the detailed test steps. |
| UAT Cycle 2 | Proposed using two or three short Korean sample presentations with scripts divided by slide. Testers would judge whether the scores were reasonable and whether the cited evidence supported them, with a reason for disagreement. Google Forms versus HTML and whether to reveal the score before judgment remained open. A separate proposal would compare Q&A for elementary students and professionals using the same sample presentation. |

#### Actions

| TO-DO | Requirements / expected output | Due date | Owner(s) |
| --- | --- | --- | --- |
| Open the UI PR | Apply the redesign on the updated `main` and hand off the PR for localization. | 2026-11-20 target discussed. 2026-11-21 fallback discussed. | Jaewon |
| Add Korean UI and feedback support | Add the language changes to the same PR and preserve evidence quotes in the spoken language. | Before alpha testing. 2026-11-22 was discussed as a target. | Seoyeon |
| Update repository documentation | Update the README and testing documentation for the current baseline. | README for the 2026-11-20 submission. Testing documentation due date not recorded. | Injoon |
| Finish the alpha pre-survey | Submit one team response and flesh out the five scenarios, setup instructions and cost estimate. | Not recorded | Not recorded |
| Prepare ONE store proof | Capture the registration proof for submission to eTL. | 2026-11-22 at 23:59 KST. [Course announcement](https://swpp2026fall.slack.com/archives/C0BUL8N1864/p1794617440997969) | Not recorded |
| Prepare UAT Cycle 2 materials | Draft sample slides, Korean scripts divided by slide and a questionnaire for score agreement and evidence relevance. | Before the planned 2026-11-23 session | Not recorded |
| Publish the kickoff minutes | Add the dated meeting record to the team repository. | Not recorded | Injoon |

#### Next check-in

- **Next meeting:** Not recorded. The team discussed UAT Cycle 2 for Monday, 2026-11-23.
- **Source:** Team kickoff transcript supplied on 2026-11-19.
