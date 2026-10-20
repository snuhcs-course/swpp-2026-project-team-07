# AI-assisted with OpenAI Codex, 2026-10-20.
"""Real ZIP/CLI tests for development-only session selection; no private fixtures."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SCRIPT = Path(__file__).with_name('select_development_sessions.py')


class SelectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.source = self.folder / 'original.zip'
        self.review = self.folder / 'selection.json'
        self.output = self.folder / 'development.zip'
        self.sessions = []
        with zipfile.ZipFile(self.source, 'w') as z:
            for session_id, text in [('app', 'Implement OutLoud recording'),
                                     ('report', 'Explain AI collaboration reporting'),
                                     ('mixed', 'App coding and unrelated exam planning')]:
                path = f'codex/{session_id}/session.jsonl'
                body = (json.dumps({'text': text}) + '\n').encode()
                z.writestr(path, body)
                self.sessions.append({'tool': 'codex', 'session_id': session_id,
                                      'files': [{'archive_path': path, 'kind': 'session',
                                                 'exported_bytes': len(body),
                                                 'exported_sha256': hashlib.sha256(body).hexdigest(),
                                                 'omitted_lines': []}]})
            z.writestr('manifest.json', json.dumps({'format_version': 1,
                        'generator': {'name': 'session-exporter', 'version': '0.1.0'},
                        'query': {'repository': '/example/OutLoud'},
                        'sessions': self.sessions, 'excluded_sessions': [],
                        'privacy': {'final_rescan': 'passed'}}))
        self.original_source_bytes = self.source.read_bytes()

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)],
                              text=True, capture_output=True)

    def initialize(self):
        result = self.run_cli('init', self.source, self.review)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(self.review.read_text())

    def reviewed(self):
        selection = self.initialize()
        for item in selection['sessions']:
            item.update(decision='include' if item['session_id'] == 'app' else 'exclude',
                        reason='App implementation' if item['session_id'] == 'app' else 'Reporting or mixed topics')
        self.review.write_text(json.dumps(selection))
        return selection

    def test_init_leaves_every_session_pending_regardless_of_repository(self):
        selection = self.initialize()
        self.assertEqual([s['decision'] for s in selection['sessions']], ['pending'] * 3)
        self.assertFalse(self.output.exists())

    def test_build_excludes_reporting_and_mixed_session_bytes(self):
        self.reviewed()
        result = self.run_cli('build', self.source, self.review, self.output)
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.output) as z:
            self.assertEqual(set(z.namelist()), {'manifest.json', 'codex/app/session.jsonl'})
            self.assertEqual(z.read('codex/app/session.jsonl'), b'{"text": "Implement OutLoud recording"}\n')
            self.assertNotIn(b'Explain AI collaboration', b''.join(z.read(n) for n in z.namelist()))
            self.assertIsNone(z.testzip())
        self.assertEqual(self.source.read_bytes(), self.original_source_bytes)

    def test_pending_or_missing_decisions_prevent_any_output(self):
        self.initialize()
        result = self.run_cli('build', self.source, self.review, self.output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('pending', result.stderr)
        self.assertFalse(self.output.exists())
        selection = json.loads(self.review.read_text())
        selection['sessions'].pop()
        self.review.write_text(json.dumps(selection))
        self.assertNotEqual(self.run_cli('build', self.source, self.review, self.output).returncode, 0)
        self.assertFalse(self.output.exists())

    def test_wrong_source_fingerprint_and_duplicate_decisions_are_rejected(self):
        selection = self.reviewed()
        selection['source_archive_sha256'] = '0' * 64
        self.review.write_text(json.dumps(selection))
        self.assertNotEqual(self.run_cli('build', self.source, self.review, self.output).returncode, 0)
        selection['source_archive_sha256'] = hashlib.sha256(self.source.read_bytes()).hexdigest()
        selection['sessions'].append(selection['sessions'][0])
        self.review.write_text(json.dumps(selection))
        self.assertNotEqual(self.run_cli('build', self.source, self.review, self.output).returncode, 0)
        self.assertFalse(self.output.exists())

    def test_existing_output_is_preserved(self):
        self.reviewed()
        self.output.write_bytes(b'Keep existing evidence')
        self.assertNotEqual(self.run_cli('build', self.source, self.review, self.output).returncode, 0)
        self.assertEqual(self.output.read_bytes(), b'Keep existing evidence')

    def test_private_outputs_cannot_be_written_under_a_git_worktree(self):
        self.reviewed()
        checkout = self.folder / 'checkout'
        checkout.mkdir()
        (checkout / '.git').write_text('gitdir: elsewhere')
        inside = checkout / 'nested' / 'private.zip'
        inside.parent.mkdir()
        result = self.run_cli('build', self.source, self.review, inside)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Git', result.stderr)
        self.assertFalse(inside.exists())

    def test_included_file_hash_mismatch_leaves_no_partial_archive(self):
        selection = self.reviewed()
        with zipfile.ZipFile(self.source) as z:
            files = {n: z.read(n) for n in z.namelist()}
        files['codex/app/session.jsonl'] = b'Changed bytes without updating manifest'
        with zipfile.ZipFile(self.source, 'w') as z:
            for name, body in files.items():
                z.writestr(name, body)
        selection['source_archive_sha256'] = hashlib.sha256(self.source.read_bytes()).hexdigest()
        self.review.write_text(json.dumps(selection))
        result = self.run_cli('build', self.source, self.review, self.output)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('hash', result.stderr.lower())
        self.assertFalse(self.output.exists())
        self.assertEqual(set(self.folder.iterdir()), {self.source, self.review})

    def test_missing_reason_or_unknown_decision_does_not_default_to_include(self):
        selection = self.reviewed()
        for decision, reason in [('include', ''), ('maybe', 'Not reviewed')]:
            selection['sessions'][0].update(decision=decision, reason=reason)
            self.review.write_text(json.dumps(selection))
            self.assertNotEqual(self.run_cli('build', self.source, self.review, self.output).returncode, 0)
            self.assertFalse(self.output.exists())

    def test_excluded_freeform_review_notes_do_not_enter_filtered_archive(self):
        selection = self.reviewed()
        selection['sessions'][1]['reason'] = 'Private unrelated conversation quotation'
        selection['sessions'][1]['notes'] = 'A private personal question copied during topic review'
        self.review.write_text(json.dumps(selection))
        result = self.run_cli('build', self.source, self.review, self.output)
        self.assertEqual(result.returncode, 0, result.stderr)
        with zipfile.ZipFile(self.output) as z:
            body = b''.join(z.read(n) for n in z.namelist())
        self.assertNotIn(b'Private unrelated conversation quotation', body)
        self.assertNotIn(b'A private personal question', body)

if __name__ == '__main__':
    unittest.main()
