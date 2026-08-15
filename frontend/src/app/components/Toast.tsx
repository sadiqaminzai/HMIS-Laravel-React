import React, { useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'warning' | 'danger';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const config = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />,
      text: 'text-green-800 dark:text-green-200'
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />,
      text: 'text-yellow-800 dark:text-yellow-200'
    },
    danger: {
      bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />,
      text: 'text-red-800 dark:text-red-200'
    }
  };

  const style = config[type];

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg ${style.bg} animate-slide-in-right`}>
      {style.icon}
      <span className={`text-xs font-medium ${style.text}`}>{message}</span>
      <button
        onClick={onClose}
        className={`ml-2 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 ${style.text}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
