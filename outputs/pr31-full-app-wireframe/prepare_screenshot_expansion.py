#!/usr/bin/env python3
"""Prepare reviewed physical-phone captures for the authorized demo expansion.

This script writes a draft manifest by default. It does not control the phone,
call providers, or replace the released screenshot manifest. Run with --apply
only after capture selection is complete.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
SPEC = {
    'S28': ('PDF import · audience and time setup', 'upload', 'Home & import', [
        'New synthetic demo PDF imported with the user\'s expanded authorization.',
        'The actual setup screen shows three slides, no time limit, and Students selected.'
    ], [('S29', 'Confirm presentation setup')]),
    'S29': ('New presentation · ready to record', 'rehearse', 'Live microphone rehearsal', [
        'The imported synthetic demo is ready for a three-slide microphone rehearsal.',
        'The phone shows a three-minute full-run target and Record control.'
    ], [('S30', 'Tap Record')]),
    'S30': ('Microphone capture · countdown', 'rehearse', 'Live microphone rehearsal', [
        'Actual recording countdown, captured before audio recording begins.'
    ], [('S31', 'Countdown completes')]),
    'S31': ('Live microphone · slide 1', 'rehearse', 'Live microphone rehearsal', [
        'The physical phone is recording agent-operated synthetic speech played acoustically.',
        'The timer, recording waveform, Stop control and On pace indicator are visible.'
    ], [('S32', 'Swipe to slide 2 while recording')]),
    'S32': ('Live microphone · slide 2', 'rehearse', 'Live microphone rehearsal', [
        'Audio capture continues on the second slide of the same full rehearsal.',
        'The actual Ahead timing cue and live waveform are preserved.'
    ], [('S33', 'Swipe to slide 3 while recording')]),
    'S33': ('Live microphone · slide 3', 'rehearse', 'Live microphone rehearsal', [
        'Audio capture continues on the third slide, with the elapsed timer and Stop control.',
        'This is a real microphone capture of synthetic demo content.'
    ], [('S34', 'Stop and save the full run')]),
    'S34': ('Full Review · saved take processing', 'full', 'Review & playback', [
        'The new microphone take has been saved and opened in Full Review.',
        'Transcription is pending; the score and assessment are not complete in this frame.'
    ], [('S35', 'Transcription finishes')]),
    'S35': ('Full Review · transcription available', 'full', 'Review & playback', [
        'A real provider transcript of the acoustic demo is now visible.',
        'The app reports Grading unavailable at this moment; the screenshot preserves that intermediate state.'
    ], [('S36', 'Tap slide 1 to review'), ('S40', 'Assessment starts when service is available')]),
    'S36': ('Slide Review · recorded demo transcript', 'review', 'Review & playback', [
        'The recorded first slide and its provider transcript are available for review.',
        'Assessment is not complete in this captured intermediate state.'
    ], [('S37', 'Play the recorded slide'), ('S35', 'Open Full Review')]),
    'S37': ('Slide Review · playing with transcript highlight', 'review', 'Review & playback', [
        'Actual saved audio playback is running with the pause control and elapsed progress.',
        'The current transcript word is highlighted by the app.'
    ], [('S36', 'Pause playback'), ('S39', 'Return to rehearsal after cue generation')]),
    'S39': ('Rehearsal · generated coaching cues', 'rehearse', 'Live microphone rehearsal', [
        'The demo presentation now has actual provider-generated coaching cues.',
        'These visible cue results were generated after the user authorized the expanded capture.'
    ], [('S40', 'Open Full Review'), ('S51', 'Tap Redo slide 1')]),
    'S40': ('Full Review · provider assessment in progress', 'full', 'Review & playback', [
        'The app shows Grading and one of three recorded slides assessed.',
        'The numeric score has not finished processing in this frame.'
    ], [('S43', 'Assessment finishes; open slide Review')]),
    'S43': ('Slide Review · completed score and findings', 'review', 'Review & playback', [
        'Actual provider assessment is complete: all three slides assessed and two findings across the presentation.',
        'This captured slide shows a score of 67 and the existing recorded transcript.',
        'Captured from Full Review, so Back returns there. After Compare, this Review content instead has Back to slides.'
    ], [('S44', 'Open Audience Q&A'), ('S50', 'Open Full Review')]),
    'S50': ('Full Review · completed presentation score', 'full', 'Review & playback', [
        'The actual provider presentation assessment shows an overall score of 64 and Competent.',
        'All three slide scores are 67; the graded explanation, two verified findings and cited audio intervals are visible.',
        'Captured from rehearsal with Back to slides. Entry from slide Review instead shows Back to review.'
    ], [('S43', 'Tap slide 1'), ('S39', 'Back to rehearsal')]),
    'S44': ('Audience Q&A · generated question', 'qa', 'Audience Q&A', [
        'The actual generated first question is ready for the Students audience.',
        'The question is linked to the second slide of the synthetic demo.'
    ], [('S45', 'Tap microphone to answer'), ('S43', 'Back to slide Review')]),
    'S45': ('Audience Q&A · answer countdown', 'qa', 'Audience Q&A', [
        'Actual microphone countdown before recording an answer to the displayed question.'
    ], [('S46', 'Countdown completes')]),
    'S46': ('Audience Q&A · live microphone answer', 'qa', 'Audience Q&A', [
        'The phone is recording the synthetic spoken demo answer through its microphone.',
        'Listening, the running timer, waveform and Stop control are visible.'
    ], [('S47', 'Stop and save answer')]),
    'S47': ('Audience Q&A · transcription and evaluation', 'qa', 'Audience Q&A', [
        'The recorded answer is saved; the app shows its duration and processing state.',
        'Transcribing and reviewing is visible; completion is not implied by this frame.'
    ], [('S48', 'Answer evaluation completes')]),
    'S48': ('Audience Q&A · evaluated answer', 'qa', 'Audience Q&A', [
        'The saved 57-second demo answer received an actual provider evaluation and an Answered status.',
        'The app shows its Did it answer, Evidence and Clarify feedback sections.'
    ], [('S49', 'Scroll to follow-up and transcript'), ('S43', 'Back to slide Review')]),
    'S49': ('Audience Q&A · follow-up and answer transcript', 'qa', 'Audience Q&A', [
        'An actual generated follow-up question and the saved answer transcript are visible.',
        'The follow-up is offered for recording; no follow-up answer was recorded for this capture.'
    ], [('S48', 'Scroll to evaluation'), ('S43', 'Back to slide Review')]),
    'S51': ('Redo · confirm another slide take', 'rehearse', 'Live microphone rehearsal', [
        'The actual confirmation explains that the redo can be compared with the existing slide take.',
        'This later redo uses only the new synthetic demo presentation.'
    ], [('S52', 'Confirm Redo'), ('S39', 'Cancel')]),
    'S52': ('Redo microphone · countdown', 'rehearse', 'Live microphone rehearsal', [
        'A second live microphone take begins with the real countdown.',
        'The earlier generated coaching cue remains visible.'
    ], [('S53', 'Countdown completes')]),
    'S53': ('Redo microphone · live slide take', 'rehearse', 'Live microphone rehearsal', [
        'The phone is recording a second synthetic spoken version of slide 1.',
        'The running timer, waveform and On pace cue are actual device UI.'
    ], [('S54', 'Stop and compare takes')]),
    'S54': ('Compare · new take transcribing', 'compare', 'Compare recordings', [
        'The current 31-second take is shown beside the new 25-second take.',
        'The new take is still transcribing in this real intermediate frame; Keep current is selected.'
    ], [('S55', 'Transcription and comparison finish')]),
    'S55': ('Compare · completed take metrics', 'compare', 'Compare recordings', [
        'Both real takes have transcripts and metrics: the new take is six seconds faster.',
        'Keep current was confirmed after capture, retaining the original full demo take.',
        'Confirmation opens the Review content illustrated by S43, with Back to slides in this entry context.'
    ], [('S43', 'Confirm Keep current and return to slide Review')]),
}


def prepare():
    original_path = ROOT / 'screenshot-manifest.saved-data.json'
    if original_path.exists():
        manifest = json.loads(original_path.read_text())
    else:
        original_text = (ROOT / 'screenshot-manifest.json').read_text()
        manifest = json.loads(original_text)
        if '--apply' in sys.argv:
            original_path.write_text(original_text)
    records = json.loads((ROOT / 'expanded-capture-evidence.json').read_text())['records']
    by_id = {}
    for record in records:
        path = Path(record['normalized_result']['local_path'])
        by_id[path.parent.name.split('-')[0]] = record
    captures = manifest['captures']
    old = {capture['id']: capture for capture in captures}
    for capture in captures:
        capture['capture_session'] = 'earlier saved-data inspection'
    for ident, (title, route, group, notes, transitions) in SPEC.items():
        record = by_id[ident]
        result = record['normalized_result']
        original_path = Path(result['local_path'])
        path = ROOT / 'captures' / original_path.parent.name / original_path.name
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != result['sha256']:
            raise ValueError(f'Capture evidence hash mismatch: {ident}')
        captures.append({
            'id': ident, 'title': title, 'screen': route,
            'file': path.relative_to(ROOT).as_posix(), 'group': group,
            'notes': notes, 'transitions': [{'to': to, 'label': label} for to, label in transitions],
            'capture_session': 'authorized synthetic demo',
            'evidence_id': record['evidence_id'], 'sha256': digest,
        })
    old['S22']['transitions'].append({'to': 'S28', 'label': 'Later demo: select synthetic PDF and complete import'})
    manifest['source']['provenance'] = 'Physical Samsung phone running the installed Scribe release; all 112 bundled application source modules match PR #31 f1af9dd. Earlier saved-data captures are retained alongside a later authorized synthetic demo.'
    manifest['source']['limitations'] = [
        'Earlier screenshots preserve the original saved-data-only inspection. The user subsequently authorized live microphone, import, Q&A and review capture with synthetic demo content.',
        'Every screen image is an unmodified physical-phone capture; offline, unavailable and processing states are retained.',
        'New rehearsal and Q&A audio were recorded through the phone microphone from agent-operated synthetic speech played acoustically. This is a demonstration, not a human usability test.',
        'Visible provider transcripts, coaching, question and score results are actual runtime responses; intermediate pending states are labeled separately.',
        'The first demo transcript used the original local service. The exact saved take and media were then carried to an isolated backend to recover a persistent HTTP connection; its 110 backend source modules match PR31 and it served the later demo AI responses.',
        'The installed bundle\'s 112 imported application modules match PR31; the retained source map is local build evidence, not a signed Git identifier.',
        'A captured route does not establish every conditional, failure, or destructive path. The earlier source board retains the full source inventory.',
        'The phone was left on the new demo Full Review after Keep current preserved the original 75-second demo run; existing personal presentations were retained.',
    ]
    manifest['missing_states'] = [
        {'screen': 'upload', 'reason': 'The genuine native PDF import succeeded and its setup is captured. The brief analysis state before setup passed before a distinct screenshot could be taken.'},
        {'screen': 'qa', 'reason': 'Generated questions, live answer recording, evaluation and the offered follow-up are captured. A separate follow-up answer and archive were not created.'},
        {'screen': 'conditional states', 'reason': 'All seven app routes are represented. Destructive choices, exhaustive error recovery and every conditional correction or editing panel were not exercised; the source wireframe board inventories the broader state space.'},
    ]
    group_order = ['Home & import', 'Presentation & rehearsal', 'Live microphone rehearsal', 'Review & playback', 'Audience Q&A', 'Compare recordings']
    captures.sort(key=lambda c: group_order.index(c['group']) if c['group'] in group_order else len(group_order))
    dest = ROOT / ('screenshot-manifest.json' if '--apply' in sys.argv else 'screenshot-manifest.expanded-draft.json')
    dest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(dest), 'captures': len(captures), 'routes': sorted({c['screen'] for c in captures}), 'action_links': sum(len(c['transitions']) for c in captures)}, indent=2))

if __name__ == '__main__':
    prepare()
