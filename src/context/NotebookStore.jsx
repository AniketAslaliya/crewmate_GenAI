import { create } from "zustand";

/**
 * Zustand store for caching notebook feature responses (IN-MEMORY ONLY)
 * 
 * IMPORTANT: No persistence middleware
 * - Cache exists only in memory during the current page session
 * - Cleared on page reload/refresh
 * - Prevents React component serialization issues that occur with localStorage/sessionStorage
 * 
 * This approach:
 * ✓ Allows fast feature switching without redundant API calls (primary goal)
 * ✓ Avoids "Objects are not valid as React children" serialization errors
 * ✓ Simple and reliable - no storage corruption possible
 * 
 * Trade-off: Cache clears on page reload (acceptable for this use case)
 */
const useNotebookStore = create((set, get) => ({
  // Structure: { [notebookId]: { summary: <Component>, questions: <Component>, etc } }
  notebookCache: {},

  // Get cached data for a specific notebook and feature
  getCachedFeature: (notebookId, featureKey) => {
    const cache = get().notebookCache;
    return cache[notebookId]?.[featureKey] || null;
  },

  // Store feature data for a notebook
  setCachedFeature: (notebookId, featureKey, data) => {
    set((state) => ({
      notebookCache: {
        ...state.notebookCache,
        [notebookId]: {
          ...state.notebookCache[notebookId],
          [featureKey]: data,
        },
      },
    }));
  },

  // Clear cache for a specific notebook
  clearNotebookCache: (notebookId) => {
    set((state) => {
      const newCache = { ...state.notebookCache };
      delete newCache[notebookId];
      return { notebookCache: newCache };
    });
  },

  // Clear all cache
  clearAllCache: () => {
    set({ notebookCache: {} });
  },
}));

export default useNotebookStore;
