import { describe, it, expect } from 'vitest';
import { historyReducer, initialHistory } from './history.js';

function reset(present) {
  return historyReducer(initialHistory, { type: 'RESET', present });
}

describe('historyReducer', () => {
  it('RESET sets the present and clears history', () => {
    const s = reset({ v: 0 });
    expect(s.present).toEqual({ v: 0 });
    expect(s.past).toHaveLength(0);
    expect(s.future).toHaveLength(0);
  });

  it('SET pushes onto the past and supports value or function updaters', () => {
    let s = reset({ v: 0 });
    s = historyReducer(s, { type: 'SET', updater: { v: 1 } });
    expect(s.present).toEqual({ v: 1 });
    expect(s.past).toHaveLength(1);
    s = historyReducer(s, { type: 'SET', updater: (p) => ({ v: p.v + 1 }) });
    expect(s.present).toEqual({ v: 2 });
    expect(s.past).toHaveLength(2);
  });

  it('UNDO and REDO move through history', () => {
    let s = reset({ v: 0 });
    s = historyReducer(s, { type: 'SET', updater: { v: 1 } });
    s = historyReducer(s, { type: 'UNDO' });
    expect(s.present).toEqual({ v: 0 });
    expect(s.future).toHaveLength(1);
    s = historyReducer(s, { type: 'REDO' });
    expect(s.present).toEqual({ v: 1 });
    expect(s.future).toHaveLength(0);
  });

  it('is a no-op when the updater returns the same reference', () => {
    const s = reset({ v: 0 });
    const same = s.present;
    const s2 = historyReducer(s, { type: 'SET', updater: () => same });
    expect(s2).toBe(s);
  });

  it('coalesces consecutive edits sharing a key into one undo step', () => {
    let s = reset({ name: '' });
    s = historyReducer(s, { type: 'SET', updater: { name: 'a' }, coalesceKey: 'name' });
    s = historyReducer(s, { type: 'SET', updater: { name: 'ab' }, coalesceKey: 'name' });
    expect(s.past).toHaveLength(1);
    expect(s.present).toEqual({ name: 'ab' });
    s = historyReducer(s, { type: 'UNDO' });
    expect(s.present).toEqual({ name: '' });
  });

  it('does not coalesce edits with different keys', () => {
    let s = reset({ name: '', notes: '' });
    s = historyReducer(s, { type: 'SET', updater: { name: 'a', notes: '' }, coalesceKey: 'name' });
    s = historyReducer(s, { type: 'SET', updater: { name: 'a', notes: 'x' }, coalesceKey: 'notes' });
    expect(s.past).toHaveLength(2);
  });

  it('caps the past stack at 100 entries', () => {
    let s = reset({ n: 0 });
    for (let i = 1; i <= 105; i++) {
      s = historyReducer(s, { type: 'SET', updater: { n: i } });
    }
    expect(s.past).toHaveLength(100);
    expect(s.present).toEqual({ n: 105 });
  });

  it('clears the redo stack when a new edit is applied after undo', () => {
    let s = reset({ n: 0 });
    s = historyReducer(s, { type: 'SET', updater: { n: 1 } });
    s = historyReducer(s, { type: 'UNDO' });
    expect(s.future).toHaveLength(1);
    s = historyReducer(s, { type: 'SET', updater: { n: 2 } });
    expect(s.future).toHaveLength(0);
  });
});
