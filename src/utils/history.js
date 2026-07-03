// Undo/redo history for the editor's mind map state.
//
// The editor already produces a fresh immutable `nodes` object on every
// mutation, so snapshots are cheap (structural sharing). We keep past/present/
// future stacks and coalesce rapid same-source edits (typing in the title or a
// notes field) into a single undo entry via `coalesceKey`.

const HISTORY_LIMIT = 100;

export const initialHistory = {
  past: [],
  present: null,
  future: [],
  // Tracks the coalesce key of the last SET so consecutive edits from the same
  // source (e.g. one continuous typing run) collapse into one history entry.
  lastKey: null,
};

function resolve(updater, present) {
  return typeof updater === 'function' ? updater(present) : updater;
}

export function historyReducer(state, action) {
  switch (action.type) {
    // Load a map fresh, clearing all history.
    case 'RESET':
      return { past: [], present: action.present, future: [], lastKey: null };

    // Apply a user edit. Pushes the current present onto the past unless this
    // edit coalesces with the previous one (same non-null coalesceKey).
    case 'SET': {
      const next = resolve(action.updater, state.present);
      if (next === state.present) return state; // no-op update

      const key = action.coalesceKey ?? null;
      if (key !== null && key === state.lastKey) {
        // Continuation of the same edit run: replace present in place.
        return { ...state, present: next, future: [], lastKey: key };
      }

      const past = [...state.past, state.present];
      if (past.length > HISTORY_LIMIT) past.shift();
      return { past, present: next, future: [], lastKey: key };
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastKey: null,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        lastKey: null,
      };
    }

    default:
      return state;
  }
}
