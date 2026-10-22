"""Checks for missing files and weighted, unrounded coverage enforcement.

AI-generated with OpenAI Codex, 2026-10-22.
Attribution: docs/ai-collaboration-prompts-iteration-2.md#coverage-setup-and-first-measurement--october-22-2026
"""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from coverage_report import aggregate, scope


class CoverageReportTests(unittest.TestCase):
    def test_weighted_counts_and_missing_files(self):
        policy = {"groups": {
            "mobile_logic": {"name": "Logic", "maintainer": "Test", "lines": 85, "branches": 75},
            "mobile_ui": {"name": "UI", "maintainer": "Test", "lines": 70, "branches": 60},
        }}
        expected = {"src/a.ts": "mobile_logic", "src/b.ts": "mobile_logic", "src/ui.tsx": "mobile_ui"}
        def counts(covered, total):
            return {m: {"covered": covered, "total": total} for m in ["lines", "branches"]}
        raw = {"src/a.ts": counts(1, 1), "src/b.ts": counts(0, 99), "src/ui.tsx": counts(1, 1)}
        groups = aggregate("mobile", raw, expected, policy)
        self.assertEqual(groups["mobile_logic"]["counts"]["lines"]["pct"], 1.0)
        self.assertFalse(groups["mobile_logic"]["passed"])
        self.assertTrue(groups["mobile_ui"]["passed"])
        del raw["src/b.ts"]
        with self.assertRaisesRegex(ValueError, "Source files missing"):
            aggregate("mobile", raw, expected, policy)

    def test_custom_migrations_remain_in_scope(self):
        included, excluded = scope("backend")
        self.assertIn("rehearsals/migrations/0004_preserve_existing_attempts.py", included)
        self.assertIn("rehearsals/migrations/0008_transcriptcorrection_feedbackanalysis_analysis_type_and_more.py", included)
        self.assertTrue(any(f["path"] == "rehearsals/migrations/0001_initial.py" for f in excluded))
        self.assertNotIn("rehearsals/test_feedback.py", included)

    def test_python_collection_includes_missed_paths_and_unimported_files(self):
        with tempfile.TemporaryDirectory(prefix="outloud-python-coverage-") as directory:
            folder = Path(directory).resolve()
            (folder / "choose.py").write_text('def choose(flag):\n    if flag:\n        return "yes"\n    return "no"\n\nchoose(True)\n')
            (folder / "never.py").write_text('def never():\n    return "never"\n')
            for args in [["run", "--branch", "--source=.", "choose.py"], ["json", "-o", "result.json"]]:
                subprocess.run([sys.executable, "-m", "coverage", *args], cwd=folder, check=True, capture_output=True)
            files = json.loads((folder / "result.json").read_text())["files"]
            self.assertIn(3, files["choose.py"]["executed_lines"])
            self.assertIn(4, files["choose.py"]["missing_lines"])
            self.assertGreater(files["choose.py"]["summary"]["missing_branches"], 0)
            self.assertEqual(files["never.py"]["summary"]["covered_lines"], 0)


if __name__ == "__main__":
    unittest.main()
