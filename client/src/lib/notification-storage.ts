import type { User } from "@/types";

function storageKey(user?: User) {
  return user?.tenant?.id ? `ez:seen-tasks:${user.tenant.id}:${user.id}` : null;
}
export function seenTaskIds(user?: User): string[] {
  const key = storageKey(user);
  if (!key) return [];
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === "string").slice(-500)
      : [];
  } catch {
    return [];
  }
}
export function markTaskSeen(user: User, taskId: string) {
  const key = storageKey(user);
  if (!key) return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify([...new Set([...seenTaskIds(user), taskId])].slice(-500)),
    );
  } catch {
    /* Notification navigation still works if browser storage is unavailable. */
  }
}
