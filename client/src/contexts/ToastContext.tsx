/**
 * Toast Context Provider
 * Provides toast functionality throughout the app
 */

import { createContext, useContext, ReactNode } from 'react';
import { useToast as useToastHook } from '@/hooks/useToast';
import { Toaster } from '@/components/common/Toast';
import type { Toast } from '@/hooks/useToast';

interface ToastContextType {
  toast: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (toastId: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, toast, dismiss } = useToastHook();

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}
