# Feedback v3 smoke test on the deployed backend. Makes REAL paid OpenRouter calls.
# AI-assisted with Claude Code, prompted by Seoyeon (November 15, 2026); see docs/ai-collaboration-prompts.md.
#
# Run inside the API container after FEEDBACK_V3_ENABLED=true:
#   python manage.py shell < smoke_feedback_v3.py
# Optional: set SMOKE_ATTEMPT_ID to choose a recording; otherwise the newest
# completed presentation recording longer than 30 seconds is used.
# Prints statuses, scores, timings and token counts only: no transcript or feedback text.
import os
import time

from rehearsals.feedback_v3 import pipeline
from rehearsals.models import Attempt, FeedbackRun, QaAnswer

chosen = os.environ.get('SMOKE_ATTEMPT_ID')
if chosen:
    attempt = Attempt.objects.select_related('deck').get(pk=chosen)
else:
    answers = QaAnswer.objects.values_list('attempt_id', flat=True)
    attempt = (Attempt.objects.select_related('deck')
               .filter(status='completed', transcript__isnull=False, duration_ms__gt=30000)
               .exclude(pk__in=answers).order_by('-created_at').first())
if attempt is None:
    raise SystemExit('No completed recording found. Record and transcribe one first.')

print(f'Recording {attempt.pk}: {attempt.duration_ms / 1000:.0f} s, {attempt.deck.page_count} slides, '
      f'recorded {attempt.created_at:%Y-%m-%d %H:%M} UTC')
started = time.monotonic()
run = pipeline.start(attempt.pk, retry=True)
print(f'Run {run.pk}: {run.status} (model {run.model})')

last = None
while time.monotonic() - started < 300:
    run.refresh_from_db()
    progress = pipeline.public(run)['progress']
    line = (run.status, progress['slides_done'], progress['slides_total'], progress['whole_done'])
    if line != last:
        print(f'  {time.monotonic() - started:5.1f}s  {run.status}  slides {progress["slides_done"]}/'
              f'{progress["slides_total"]}  whole {"done" if progress["whole_done"] else "pending"}')
        last = line
    if run.status not in (FeedbackRun.Status.QUEUED, FeedbackRun.Status.RUNNING):
        break
    time.sleep(2)

body = pipeline.public(run)
print(f'\nFinal status: {body["status"]} after {time.monotonic() - started:.1f} s (error: {body["error"]})')
print('Scores:', body['scores'])
for slide in body['slides']:
    levels = [c['level'] for c in slide.get('criteria', [])]
    print(f'  slide {slide["slide_index"] + 1}: {slide["status"]:<22} score={slide.get("score")} '
          f'levels={levels} improvements={len(slide.get("improvements", []))} error={slide.get("error")}')
whole = body['whole'] or {}
print(f'  whole: {whole.get("status")} score={whole.get("score")} '
      f'levels={[c["level"] for c in whole.get("criteria", [])]} priorities={len(whole.get("top_priorities", []))}')
print('Language:', body['language'], '| Pace:', (body['measurements'] or {}).get('rate'))
print('Timings (s):', body['timings'])
run.refresh_from_db()
print('Usage:', run.usage)
print('\nDone. Paste everything above into the chat.')
