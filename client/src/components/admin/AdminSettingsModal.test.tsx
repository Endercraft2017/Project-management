import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminSettingsModal from "./AdminSettingsModal";

vi.mock("./settings/MemberSelectionTab", () => ({
  default: () => <p>Member settings</p>,
}));
vi.mock("./settings/EmailSettingsTab", () => ({
  default: () => <p>Email settings</p>,
}));
vi.mock("./settings/MissingUpdatesTab", () => ({
  default: () => <p>Update settings</p>,
}));
vi.mock("./settings/AutomatedRemindersTab", () => ({
  default: () => <p>Reminder settings</p>,
}));
vi.mock("./settings/WorkspaceDataTab", () => ({
  default: () => <p>Workspace export controls</p>,
}));

it("provides a named modal and selectable settings tabs including workspace data", async () => {
  render(<AdminSettingsModal isOpen onClose={vi.fn()} initialTab="data" />);
  expect(
    screen.getByRole("dialog", { name: "Admin Settings" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("tablist", { name: "Admin settings sections" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Workspace data" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tabpanel")).toHaveTextContent(
    "Workspace export controls",
  );
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Team Members" }), {
    button: 0,
    ctrlKey: false,
  });
  await waitFor(() =>
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Member settings"),
  );
});

it("supports an accessible close control and Escape", async () => {
  const close = vi.fn();
  render(<AdminSettingsModal isOpen onClose={close} />);
  fireEvent.click(screen.getByRole("button", { name: "Close admin settings" }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(close).toHaveBeenCalledTimes(2));
});
