import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

const indexJs = fs.readFileSync(new URL('./index/index.js', import.meta.url), 'utf8');
const briefJs = fs.readFileSync(new URL('./planning/living-brief.js', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

test('the guest brief is stored from the captured text before it is cleared', () => {
  const saveAt = indexJs.indexOf("localStorage.setItem('pendingGuestBrief'");
  const deleteAt = indexJs.indexOf('delete window.planningText');
  assert.ok(saveAt > 0);
  assert.ok(deleteAt > saveAt);
  assert.match(indexJs, /planningText: planningText \|\| null/);
  assert.match(indexJs, /messages: messages/);
  assert.match(indexJs, /scheduleGuestBriefRestore/);
  assert.match(briefJs, /restore: restoreLivingBrief/);
});

test('the signup modal says the idea is saved and returns to the brief', () => {
  assert.match(home, /Your idea is saved/);
  assert.match(home, /resumeBrief%3D1/);
  assert.match(home, /No card/);
});
