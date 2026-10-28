// Per-document pin: browser cookies are shared by tabs, this value is not.
let context: string | undefined;
let changed = false;
export const getWorkspaceContext = () => context;
export const workspaceContextChanged = () => changed;
export function rememberWorkspaceContext(
  value: unknown,
  explicitLogin = false,
) {
  if (typeof value !== "string" || !value) return;
  if (explicitLogin || !context) {
    context = value;
    changed = false;
  } else if (context !== value) markWorkspaceChanged();
}
export function markWorkspaceChanged() {
  if (changed) return;
  changed = true;
  window.dispatchEvent(new Event("ez:workspace-session-changed"));
}
