import { createContext, useContext } from 'react';
import type { Toast } from '@/hooks/useToast';

interface ToastContextType {
  toast: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (toastId: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
