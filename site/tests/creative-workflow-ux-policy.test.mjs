import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editor=readFileSync(new URL('../src/editor.js',import.meta.url),'utf8');
const noteHandoff=readFileSync(new URL('../src/creative_workflow_note_handoff.mjs',import.meta.url),'utf8');
const proposalCompiler=readFileSync(new URL('../src/creative_workflow_proposal_compiler.mjs',import.meta.url),'utf8');

// CW-006, owner decision 2026-11-03: the author request determines structure.
// Retain offerVariants in legacy serialized graphs for compatibility, but NEVER
// resurrect its input, any three-option promise, or result quotas in the UI.
test('CW-006: all editorial inspectors are free of legacy three-variant controls',()=>{
  assert.doesNotMatch(editor,/Предлагать\s+(?:три\s+)?варианта?/i);
  assert.doesNotMatch(editor,/\b(?:gap-offer|ef-offer-variants|ux014-offer)\b/);
  assert.doesNotMatch(editor,/offerVariants\s*\?\s*['"`]\s*(?:1|3)\s+вариант/);
  assert.doesNotMatch(editor,/Подготовить\s+(?:1|3)\s+вариант/);
  assert.match(editor,/Число ветвей и число событий определяй только по самому заданию/);
});

test('CW-006: note MCP structure is content-driven and preserves free branch length',()=>{
  assert.match(noteHandoff,/CREATIVE_STRUCTURE_GUIDANCE/);
  assert.match(proposalCompiler,/не навязывай три варианта или одинаковую длину/);
  assert.match(proposalCompiler,/Количество альтернатив определяется только намерением автора/);
  assert.match(proposalCompiler,/proposal\.groups\.length<1\|\|proposal\.groups\.length>32/);
});
