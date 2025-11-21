import papi from '../Axios/paxios';

// Persistent service to handle form analysis that continues even when component unmounts
class FormAnalysisService {
  constructor() {
    this.activeRequests = new Map();
    this.completedAnalyses = new Map();
    this.listeners = new Set();
  }

  // Register a listener to be notified of analysis completion
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(fileId, result) {
    this.listeners.forEach(listener => {
      try {
        listener(fileId, result);
      } catch (err) {
        console.error('Listener error:', err);
      }
    });
  }

  // Start analysis - returns a promise that persists across component unmounts
  startAnalysis(file, language, fileId = null) {
    // Generate unique ID for this file if not provided
    const id = fileId || `${file.name}_${file.size}_${Date.now()}`;
    
    // If already analyzing this file, return existing info
    if (this.activeRequests.has(id)) {
      return { id, promise: this.activeRequests.get(id), isNew: false };
    }

    // If already completed, return cached result
    if (this.completedAnalyses.has(id)) {
      return { id, promise: Promise.resolve(this.completedAnalyses.get(id)), isNew: false };
    }

    const fd = new FormData();
    fd.append('file', file);
    fd.append('output_language', language);

    // Create and immediately start the analysis promise
    const analysisPromise = papi.post('/api/forms/analyze', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Don't use signal here - we want this to persist
      timeout: 0 // No timeout for long-running analysis
    })
      .then(res => {
        const result = {
          success: true,
          fields: res.data.fields || [],
          timestamp: Date.now()
        };
        
        // Cache the result
        this.completedAnalyses.set(id, result);
        this.activeRequests.delete(id);
        
        // Notify listeners
        this.notifyListeners(id, result);
        
        // Store in localStorage for persistence across page reloads
        try {
          const cache = JSON.parse(localStorage.getItem('formAnalysisCache') || '{}');
          cache[id] = {
            result,
            fileName: file.name,
            fileSize: file.size,
            language
          };
          localStorage.setItem('formAnalysisCache', JSON.stringify(cache));
        } catch (e) {
          console.warn('Failed to cache result:', e);
        }
        
        return result;
      })
      .catch(err => {
        // Don't cache errors
        this.activeRequests.delete(id);
        
        const error = {
          success: false,
          error: err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to analyze form.',
          timestamp: Date.now()
        };
        
        // Notify listeners of error
        this.notifyListeners(id, error);
        
        throw error;
      });

    // Store active request BEFORE returning
    this.activeRequests.set(id, analysisPromise);

    // Return immediately - the promise will resolve/reject on its own
    // and notify listeners when complete
    return { id, promise: analysisPromise, isNew: true };
  }

  // Check if analysis is in progress
  isAnalyzing(fileId) {
    return this.activeRequests.has(fileId);
  }

  // Get completed analysis
  getCompleted(fileId) {
    return this.completedAnalyses.get(fileId);
  }

  // Get from localStorage cache
  getFromCache(fileId) {
    try {
      const cache = JSON.parse(localStorage.getItem('formAnalysisCache') || '{}');
      return cache[fileId]?.result;
    } catch (e) {
      return null;
    }
  }

  // Clear specific analysis
  clear(fileId) {
    this.activeRequests.delete(fileId);
    this.completedAnalyses.delete(fileId);
    
    try {
      const cache = JSON.parse(localStorage.getItem('formAnalysisCache') || '{}');
      delete cache[fileId];
      localStorage.setItem('formAnalysisCache', JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }

  // Clear all
  clearAll() {
    this.activeRequests.clear();
    this.completedAnalyses.clear();
    try {
      localStorage.removeItem('formAnalysisCache');
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
  }
}

// Create singleton instance
const formAnalysisService = new FormAnalysisService();

export default formAnalysisService;
