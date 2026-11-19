# Export one stored feedback v3 run with the inputs the model saw, for quality review.
# AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
#
# Run inside the API container (--no-imports -v 0 keeps the output pure JSON):
#   python manage.py shell --no-imports -v 0 < export_feedback_v3_run.py > run.json
# Optional: SMOKE_ATTEMPT_ID selects the recording; default is the newest v3 run on the
# server, from any user of the shared demo. Read-only; makes no provider calls.
# The output CONTAINS the recording's transcript sentences, slide text and AI feedback
# text: share it only with intended reviewers and delete the file after review.
import json
import os

from rehearsals.feedback_v3 import llm, pipeline
from rehearsals.models import FeedbackRun

chosen = os.environ.get('SMOKE_ATTEMPT_ID')
runs = FeedbackRun.objects.select_related('attempt__deck', 'context').order_by('-created_at')
run = (runs.filter(attempt_id=chosen) if chosen else runs).first()
if run is None:
    raise SystemExit('No feedback v3 run found.')

try:
    model = llm.Config.from_env().model
except llm.LLMError:
    model = run.model
inputs = pipeline.load_inputs(run.attempt, run.context, model)
slides = []
for slide in inputs.slides:
    index = slide['index']
    status, reason = pipeline.plan_slide_reason(inputs, index)
    spoken = inputs.speech.slides.get(index)
    slides.append({
        'slide_number': index + 1,
        'profile_kind': slide['kind'],
        'slide_text_words': len(slide['text'].split()),
        'code_decision': {'status': status, 'reason': reason},
        'slide_text': slide['text'],
        'summary': slide['summary'],
        'must_cover': slide['must_cover'],
        'sentences': [{'id': s.id, 'text': s.text} for s in (spoken.sentences if spoken else [])],
    })
print(json.dumps({
    'inputs_match_run': inputs.fingerprint == run.fingerprint,
    'audience': inputs.audience, 'required_seconds': inputs.required_seconds, 'language': inputs.speech.language,
    'inputs': slides,
    'run': pipeline.public(run),
    'usage': run.usage,
}, ensure_ascii=False, indent=1))
