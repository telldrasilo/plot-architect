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

test('CW local drafts: direct manipulation has no per-card checkbox or move review',()=>{
  assert.doesNotMatch(editor,/cw-draft-check|cw-draft-pick|cw-accept-trigger|cw-move-review/);
  assert.match(editor,/function cwBeginDraftDrag/);
  assert.match(editor,/cwScheduleDraftSave\(\)/);
  assert.match(editor,/cwToggleDraftSelection/);
  assert.match(editor,/cwEnsureDraftsSynced/);
});

test('RPL: prepared replacement uses existing node inspector and workspace selections',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.ok(html.includes(editor),'embedded UI must exactly match source editor');
  assert.match(editor,/function cwStartPrep\(nodeId\)/);
  assert.match(editor,/function cwRenderPrepInspector\(el,id\)/);
  assert.match(editor,/function cwOpenPrepCandidateDialog\(/);
  assert.match(editor,/function cwSavePrepDecisions\(/);
  assert.match(editor,/function cwConfirmPrepReview\(/);
  assert.match(editor,/kind:'create_preparation'/);
  assert.match(editor,/kind:'set_preparation_candidates'/);
  assert.match(editor,/kind:'set_preparation_decisions'/);
  assert.match(editor,/kind:'apply_preparation'/);
  assert.match(editor,/Подготовить замену…/);
  assert.match(editor,/Использовать в замене/);
  assert.match(editor,/if\(selected\.type==='preparation'\)return cwRenderPrepInspector/);
  assert.match(editor,/state\.replacementPreparations\|\|\[\]/);
  // Legacy CW-010 and UX-014 editorial rewrite retain their own controls.
  assert.match(editor,/Начать замену…/);
  assert.match(editor,/Переработать событие/);
  assert.doesNotMatch(editor,/data-prep-candidate[^\n]*cw-preview-card/);
});
