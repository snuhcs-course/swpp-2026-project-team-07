import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = name => readFileSync(new URL(`../src/screens/${name}`, import.meta.url), 'utf8');
const elements = (text, name) => {
 const file = ts.createSourceFile('screen.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), found = [];
 const visit = node => { if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(file) === name) found.push(node); ts.forEachChild(node, visit); };
 visit(file); return found;
};
// OpenAI Codex, 2026-11-21: portrait preview's former audio icon now checks the server PDF/cue state.
test('recording reserves its normal panel for permanent cues and a server refresh', () => {
 const recording = source('RehearseScreen.tsx');
 assert.equal(elements(recording, 'TranscriptPanel').length, 0, 'recording must no longer show the transcript body');
 assert.equal(elements(recording, 'CueGuidancePanel').length, 1);
 const props = elements(recording, 'CueGuidancePanel')[0].attributes.getText();
 for (const prop of ['state={profiles.value}', 'slide={cur}', 'onSheetOpenChange=']) assert.ok(props.includes(prop), prop);
 assert.match(recording, /accessibilityLabel="Refresh with server"/);
 assert.match(recording, /accessibilityLabel="Refresh with server"[\s\S]*profiles\.refresh\(\)/);
 assert.match(recording, /const profiles = useSlideProfiles\(deck.id, n, active, deck\)/);
});
// Inline Review playback/corrections are exercised by ai-overview-screens and transcript-corrections-sources.
