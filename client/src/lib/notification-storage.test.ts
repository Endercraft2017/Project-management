import { beforeEach, expect, it } from "vitest";
import type { User } from "@/types";
import { markTaskSeen, seenTaskIds } from "./notification-storage";
const user = {
  id: "same-user-id",
  tenant: { id: "company-a", code: "A0000Z", name: "A" },
} as User;
beforeEach(() => localStorage.clear());
it("separates tenants even when local user and task identifiers collide", () => {
  markTaskSeen(user, "same-task");
  expect(seenTaskIds(user)).toEqual(["same-task"]);
  expect(
    seenTaskIds({ ...user, tenant: { ...user.tenant!, id: "company-b" } }),
  ).toEqual([]);
  expect(seenTaskIds({ ...user, tenant: undefined })).toEqual([]);
});
it("recovers from corrupt browser storage without breaking notifications", () => {
  localStorage.setItem("ez:seen-tasks:company-a:same-user-id", "{invalid");
  expect(seenTaskIds(user)).toEqual([]);
  markTaskSeen(user, "task");
  expect(seenTaskIds(user)).toEqual(["task"]);
});
