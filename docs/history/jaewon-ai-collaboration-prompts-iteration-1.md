# Jaewon — Iteration 1 AI collaboration prompts

This file contains Jaewon's original PDF-import and Practice-flow prompts recovered from this Codex chat. The feature record dates the work to October 4, 2026. The chat transcript available here does not expose stable source-message IDs or exact timestamps, so none are inferred.

## J1. Local PDF import and slide-by-slide viewer

**Original user-role message in this Codex chat** (full text):

```text
I am Team mate A and I have to implement the pdf import tool for the project.
instructions are - we have the main code - do not push to main but branch it off from the github ([https://github.com/snuhcs-course/swpp-2026-project-team-07](https://github.com/snuhcs-course/swpp-2026-project-team-07))
i want to work on it off line on my mac and test it out before i uplaod the branch like the others did- but I also want to test out the main code on the android device.
I want to first implement it so that you can upload the pdf (store it in your device, not server side) and be able to see it slide by slide like described.
```

The requester identifies themself as **“Team mate A.”** The contributor mapping in the supplied appendix maps this requester (`justaoj`) to Jaewon.

## J2. Use the uploaded PDF in Practice and start at page one

**Original user-role follow-up in this Codex chat** (full text):

```text
now implement after "preview rehearsal" - it leads to the practice tab. under rehearsal, currently there are sample slides. change them to the uplaoded pdf file and maintain the next slide feature in the same tab.
```

**Original user-role follow-up in this Codex chat** (full text):

```text
also, when the app enters rehearsal/practice, make sure even if the slide was moved to a different slide in the your slides slide preview tab, when you press preview rehearsal and move to the practice slide, it always goes back to the first slide
```

**Context and decision:** These follow-ups ask for the imported PDF to appear in Practice and for Practice to open at its first page, regardless of the page selected in the slide-preview flow.
