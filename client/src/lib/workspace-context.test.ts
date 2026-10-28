import { afterEach, expect, it, vi } from "vitest";
afterEach(() => vi.resetModules());
it("pins a document to its original sign-in and reports a change rather than retargeting", async () => {
  const context = await import("./workspace-context");
  const listener = vi.fn();
  window.addEventListener("ez:workspace-session-changed", listener);
  context.rememberWorkspaceContext("company-a-session");
  context.rememberWorkspaceContext("company-b-session");
  expect(context.getWorkspaceContext()).toBe("company-a-session");
  expect(context.workspaceContextChanged()).toBe(true);
  expect(listener).toHaveBeenCalledOnce();
  context.markWorkspaceChanged();
  expect(listener).toHaveBeenCalledOnce();
  window.removeEventListener("ez:workspace-session-changed", listener);
});
it("only an explicit successful login can replace the document pin", async () => {
  const context = await import("./workspace-context");
  context.rememberWorkspaceContext("a");
  context.markWorkspaceChanged();
  context.rememberWorkspaceContext("b", true);
  expect(context.getWorkspaceContext()).toBe("b");
  expect(context.workspaceContextChanged()).toBe(false);
});
