import assert from 'node:assert/strict';
import { test } from 'node:test';

import { progressionSignal, type SessionSetSummary } from './progression.ts';

function session(id: string, reps: number[], completed: boolean[] = []): SessionSetSummary {
  return {
    sessionId: id,
    sets: reps.map((r, index) => ({ reps: r, completed: completed[index] ?? true })),
  };
}

test('no signal without at least two sessions of history', () => {
  assert.equal(progressionSignal([], 12), null);
  assert.equal(progressionSignal([session('s1', [12, 12, 12])], 12), null);
});

test('a single good session never triggers the signal, only two consecutive ones', () => {
  const sessions = [session('s2', [12, 12, 12]), session('s1', [8, 9, 10])];
  assert.equal(progressionSignal(sessions, 12), null);
});

test('two consecutive sessions at the top of the range trigger the signal', () => {
  const sessions = [session('s2', [12, 13, 12]), session('s1', [12, 12, 12])];
  assert.equal(progressionSignal(sessions, 12), 'increase_load');
});

test('a mixed session below the top of the range blocks the signal', () => {
  const sessions = [session('s2', [12, 12, 12]), session('s1', [12, 9, 12])];
  assert.equal(progressionSignal(sessions, 12), null);
});

test('a session with no completed sets counts as not at the top of the range', () => {
  const sessions = [session('s2', [12, 12], [true, true]), session('s1', [12], [false])];
  assert.equal(progressionSignal(sessions, 12), null);
});

test('only completed sets are considered when checking the top of the range', () => {
  const sessions = [session('s2', [12, 5], [true, false]), session('s1', [12, 4], [true, false])];
  assert.equal(progressionSignal(sessions, 12), 'increase_load');
});

test('an invalid maxReps never produces a signal', () => {
  const sessions = [session('s2', [12, 12]), session('s1', [12, 12])];
  assert.equal(progressionSignal(sessions, 0), null);
  assert.equal(progressionSignal(sessions, -1), null);
  assert.equal(progressionSignal(sessions, NaN), null);
});
