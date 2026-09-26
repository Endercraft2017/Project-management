/**
 * Utility functions
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date to ISO string for input fields
 */
export function formatDateInput(date: string | Date): string {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate days until deadline
 */
export function daysUntilDeadline(deadline: string | Date): number {
  const today = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get progress color based on percentage
 */
export function getProgressColor(progress: number): string {
  if (progress === 0) return 'bg-gray-200';
  if (progress < 25) return 'bg-red-500';
  if (progress < 50) return 'bg-orange-500';
  if (progress < 75) return 'bg-yellow-500';
  if (progress < 100) return 'bg-blue-500';
  return 'bg-green-500';
}

/**
 * Get deadline status color
 */
export function getDeadlineColor(deadline: string | Date): string {
  const days = daysUntilDeadline(deadline);
  if (days < 0) return 'text-red-600';
  if (days <= 3) return 'text-orange-600';
  if (days <= 7) return 'text-yellow-600';
  return 'text-green-600';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Up to two initials from a display name ("Ada Lovelace" -> "AL")
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}
