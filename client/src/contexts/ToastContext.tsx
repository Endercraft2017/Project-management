/**
 * Toast Context Provider
 * Provides toast functionality throughout the app
 */

import type { ReactNode } from 'react';
import { useToast as useToastHook } from '@/hooks/useToast';
import { Toaster } from '@/components/common/Toast';
import { ToastContext } from './toast-context';

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, toast, dismiss } = useToastHook();

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
