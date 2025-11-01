import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = ++idCounter;
    const entry = { id, duration: 5000, position: 'top-right', ...toast };
    setToasts((t) => [...t, entry]);
    if (entry.duration > 0) {
      setTimeout(() => {
        setToasts((t) => t.filter(x => x.id !== id));
      }, entry.duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => setToasts((t) => t.filter(x => x.id !== id)), []);

  const api = {
    addToast,
    removeToast,
    success: (msg, opts = {}) => addToast({ type: 'success', message: msg, ...opts }),
    error: (msg, opts = {}) => addToast({ type: 'error', message: msg, ...opts }),
    info: (msg, opts = {}) => addToast({ type: 'info', message: msg, ...opts }),
    warn: (msg, opts = {}) => addToast({ type: 'warn', message: msg, ...opts }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Toast container */}
      <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-md shadow-lg px-4 py-2 text-sm flex items-center justify-between gap-3 w-full ${t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'success' ? 'bg-green-600 text-white' : t.type === 'warn' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-white'}`}>
            <div className="flex-1 pr-3">{t.message}</div>
            <button aria-label="dismiss" onClick={() => removeToast(t.id)} className="font-semibold">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

export default ToastProvider;
