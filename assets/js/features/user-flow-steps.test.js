import test from 'node:test';
import assert from 'node:assert/strict';

import { coalesceFlowSteps, renderDetailedUserFlowRail } from './spec-viewer/modules/EnrichedOverviewRenderer.js';

test('action steps stay as separate journey steps', () => {
  const steps = [
    'User opens the booking page.',
    'Customer picks a barber and a time.',
    'Customer confirms the appointment.'
  ];
  assert.deepEqual(coalesceFlowSteps(steps), steps);
  const html = renderDetailedUserFlowRail(steps);
  assert.match(html, /User opens the booking page/);
  assert.match(html, /Customer confirms the appointment/);
  assert.equal((html.match(/user-flow-rail-step/g) || []).length, 3);
});

test('comma-chopped product sentences are shown as one readable step', () => {
  const fragments = [
    'An appointment-booking app for small businesses like barbers',
    'salons',
    'with reminders',
    'payments',
    'a calendar page',
    'a dashboard page'
  ];
  const readable = coalesceFlowSteps(fragments);
  assert.equal(readable.length, 1);
  assert.match(readable[0], /appointment-booking app for small businesses like barbers salons with reminders/);
  const html = renderDetailedUserFlowRail(fragments);
  assert.equal((html.match(/user-flow-rail-step/g) || []).length, 1);
  assert.doesNotMatch(html, />salons</);
});

test('a Start / fragment / Done wrapper is not shown as three steps', () => {
  const readable = coalesceFlowSteps([
    'Start',
    'appointment-booking app for small businesses like barbers and salons',
    'Done'
  ]);
  assert.deepEqual(readable, ['appointment-booking app for small businesses like barbers and salons']);
});
