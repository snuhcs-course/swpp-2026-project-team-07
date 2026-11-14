# Read-only AI feedback diagnostics for the deployed backend.
# AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see docs/ai-collaboration-prompts.md.
#
# Run inside the API container: python manage.py shell < diagnose_feedback.py
# Prints counts and timings only. It never prints transcripts, prompts, model
# output, slide content, keys or identifiers, and it writes nothing.
from collections import Counter, defaultdict
from datetime import timedelta
from statistics import median

from django.utils import timezone

from rehearsals.models import Attempt, DescriptionJob, FeedbackJob, FeedbackRequest, ProviderRequest

DAYS = 14
since = timezone.now() - timedelta(days=DAYS)


def kind(analysis_type):
    for prefix in ('score_', 'review_', 'qa_'):
        if analysis_type.startswith(prefix):
            return prefix[:-1]
    return analysis_type


def seconds(start, end):
    return (end - start).total_seconds() if start and end else None


def spread(values):
    values = sorted(v for v in values if v is not None)
    if not values:
        return 'n=0'
    p90 = values[int(0.9 * (len(values) - 1))]
    return f'n={len(values)} median={median(values):.1f}s p90={p90:.1f}s max={values[-1]:.1f}s'


def show(label, counter):
    print(f'  {label}: ' + (', '.join(f'{k or "-"}={v}' for k, v in counter.most_common()) or 'none'))


print(f'== OutLoud feedback diagnostics, last {DAYS} days, generated {timezone.now():%Y-%m-%d %H:%M} UTC')

print('\n== Transcription (Scribe)')
attempts = Attempt.objects.filter(created_at__gte=since)
show('attempt processing_state', Counter(attempts.values_list('processing_state', flat=True)))
show('attempt error code', Counter(e.get('code') for e in attempts.exclude(error=None).values_list('error', flat=True)
                                   if isinstance(e, dict)))
scribe = list(ProviderRequest.objects.filter(created_at__gte=since).select_related('attempt'))
show('scribe outcome', Counter(r.outcome for r in scribe))
print('  scribe call (submitted -> received):', spread(seconds(r.submitted_at, r.raw_received_at) for r in scribe))
print('  upload -> scribe received:', spread(seconds(r.attempt.created_at, r.raw_received_at) for r in scribe))
print('  recording length:', spread(r.attempt.duration_ms / 1000 for r in scribe))

print('\n== Slide profiles (DescriptionJob)')
profiles = DescriptionJob.objects.filter(queued_at__gte=since)
show('state', Counter(profiles.values_list('state', flat=True)))
show('error', Counter(profiles.exclude(error_code='').values_list('error_code', flat=True)))

print('\n== LLM feedback jobs (FeedbackJob) by type')
jobs = defaultdict(list)
for job in FeedbackJob.objects.filter(queued_at__gte=since).select_related('analysis'):
    jobs[kind(job.analysis.analysis_type)].append(job)
for name, rows in sorted(jobs.items()):
    print(f' [{name}] jobs={len(rows)}')
    show('state', Counter(r.state for r in rows))
    show('error', Counter(r.error_code for r in rows if r.error_code))
    if name == 'score':
        show('assessment_status', Counter(((r.result or {}).get('presentation_score') or {}).get('assessment_status')
                                          for r in rows if r.state == 'completed'))
    if name == 'review':
        show('slide status', Counter(s.get('status') for r in rows if r.state == 'completed'
                                     for s in (r.result or {}).get('slides', [])))
    print('  queued -> completed:', spread(seconds(r.queued_at, r.completed_at) for r in rows))

print('\n== LLM requests (FeedbackRequest) by type')
requests = defaultdict(list)
for request in FeedbackRequest.objects.filter(queued_at__gte=since).select_related('coaching_job__analysis'):
    name = 'profiles' if request.job_id else kind(request.coaching_job.analysis.analysis_type)
    requests[name].append(request)
for name, rows in sorted(requests.items()):
    print(f' [{name}] requests={len(rows)}')
    show('outcome', Counter(r.outcome for r in rows))
    show('error', Counter(r.error_code for r in rows if r.error_code))
    show('http status', Counter(r.status_code for r in rows))
    show('body issue', Counter(r.body_issue for r in rows if r.body_issue))
    print('  waiting for worker (queued -> claimed):', spread(seconds(r.queued_at, r.claimed_at) for r in rows))
    print('  waiting for quota (claimed -> submitted):', spread(seconds(r.claimed_at, r.submitted_at) for r in rows))
    print('  provider call (submitted -> received):', spread(seconds(r.submitted_at, r.received_at) for r in rows))
    tokens = sorted((r.usage or {}).get('output_tokens') or 0 for r in rows if r.usage)
    if tokens:
        print(f'  output tokens: median={median(tokens):.0f} max={tokens[-1]}')

print('\n== LLM requests per UTC day (daily cap check)')
per_day = Counter(r.submitted_at.date().isoformat() for rows in requests.values() for r in rows if r.submitted_at)
for day, count in sorted(per_day.items()):
    print(f'  {day}: {count}')
print('\n== Done. Paste everything above into the chat.')
