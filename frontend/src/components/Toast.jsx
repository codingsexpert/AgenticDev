import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      success: (msg) => console.log('Toast success:', msg),
      error: (msg) => console.error('Toast error:', msg),
      info: (msg) => console.log('Toast info:', msg),
      warning: (msg) => console.warn('Toast warning:', msg),
    };
  }
  return context;
};

const ToastItem = ({ toast, onClose }) => {
  const { type, message } = toast;

  const styles = {
    success: {
      bg: 'bg-emerald-50/95 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
      bar: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-rose-50/95 border-rose-200 text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />,
      bar: 'bg-rose-500',
    },
    warning: {
      bg: 'bg-amber-50/95 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
      bar: 'bg-amber-500',
    },
    info: {
      bg: 'bg-indigo-50/95 border-indigo-200 text-indigo-900',
      icon: <Info className="w-4 h-4 text-indigo-600 shrink-0" />,
      bar: 'bg-indigo-500',
    },
  }[type] || {
    bg: 'bg-slate-50/95 border-slate-200 text-slate-900',
    icon: <Info className="w-4 h-4 text-slate-600 shrink-0" />,
    bar: 'bg-slate-500',
  };

  return (
    <div className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all transform animate-slide-up ${styles.bg}`}>
      <div className="flex items-center space-x-3 pr-2 min-w-0">
        {styles.icon}
        <span className="text-xs font-semibold leading-snug tracking-tight break-words">
          {message}
        </span>
      </div>
      <button
        onClick={onClose}
        className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
