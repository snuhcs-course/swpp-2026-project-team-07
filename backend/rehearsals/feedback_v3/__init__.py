"""Rebuilt rehearsal feedback pipeline (v3).

AI-assisted with Claude Code, prompted by Seoyeon (November 14, 2026); see
docs/ai-collaboration-prompts.md and docs/ai-feedback-reimplementation.md.

One FeedbackRun per (attempt, inputs). Code computes measurements and points;
the model chooses rubric levels and writes coaching in small parallel calls.
"""
