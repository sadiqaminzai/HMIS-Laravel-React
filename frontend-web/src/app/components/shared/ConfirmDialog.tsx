import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmDialogProps) {
  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-6 py-2.5 text-white rounded-lg transition-colors ${variantStyles[variant]}`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="flex gap-4">
        <div className={`
          flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center
          ${variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : ''}
          ${variant === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}
          ${variant === 'info' ? 'bg-blue-100 dark:bg-blue-900/30' : ''}
        `}>
          <AlertTriangle className={`
            w-6 h-6
            ${variant === 'danger' ? 'text-red-600 dark:text-red-400' : ''}
            ${variant === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : ''}
            ${variant === 'info' ? 'text-blue-600 dark:text-blue-400' : ''}
          `} />
        </div>
        <div className="flex-1">
          <p className="text-gray-700 dark:text-gray-300">{message}</p>
        </div>
      </div>
    </Modal>
  );
}
