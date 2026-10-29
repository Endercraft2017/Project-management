import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import WorkspaceDataTab from "./WorkspaceDataTab";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
let createUrl: ReturnType<typeof vi.spyOn>;
let revokeUrl: ReturnType<typeof vi.spyOn>;
let click: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(api.get).mockReset();
  createUrl = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:private-export");
  revokeUrl = vi
    .spyOn(URL, "revokeObjectURL")
    .mockImplementation(() => undefined);
  click = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(() => undefined);
});

it("downloads through the tenant API, labels coverage and releases its private object URL", async () => {
  const blob = new Blob(['{"format":"ez-workspace-export/1"}'], {
    type: "application/json",
  });
  vi.mocked(api.get).mockResolvedValue({ data: blob });
  const view = render(<WorkspaceDataTab />);
  expect(screen.getByText(/not a restorable backup/)).toBeInTheDocument();
  expect(
    screen.getByText(/Personal notes, reminders, notifications/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Download JSON export" }));
  await screen.findByRole("status");
  expect(api.get).toHaveBeenCalledWith("/api/export/workspace", {
    responseType: "blob",
    signal: expect.any(AbortSignal),
    timeout: 45000,
  });
  expect(createUrl).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledTimes(1);
  expect(document.querySelector("a[download]")).toBeNull();
  view.unmount();
  expect(revokeUrl).toHaveBeenCalledWith("blob:private-export");
});

it.each([
  [429, /hourly limit/],
  [413, /self-service export limit/],
  [403, /administrator access/],
  [500, /could not prepare/],
] as const)(
  "explains HTTP %s without displaying the response body or starting a download",
  async (status, message) => {
    vi.mocked(api.get).mockRejectedValue({
      response: { status, data: new Blob(["PRIVATE EXPORT CONTENT"]) },
    });
    render(<WorkspaceDataTab />);
    fireEvent.click(
      screen.getByRole("button", { name: "Download JSON export" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.queryByText("PRIVATE EXPORT CONTENT"),
    ).not.toBeInTheDocument();
    expect(createUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Download JSON export" }),
    ).toBeEnabled();
  },
);

it("cancels an in-flight request when the settings panel closes", async () => {
  let resolve!: (response: { data: Blob }) => void;
  vi.mocked(api.get).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(<WorkspaceDataTab />);
  fireEvent.click(screen.getByRole("button", { name: "Download JSON export" }));
  expect(
    screen.getByRole("button", { name: "Preparing export…" }),
  ).toBeDisabled();
  const signal = vi.mocked(api.get).mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  resolve({ data: new Blob(["{}"], { type: "application/json" }) });
  await waitFor(() => expect(createUrl).not.toHaveBeenCalled());
});

it("rejects an unexpected download response", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: new Blob(["<html>"], { type: "text/html" }),
  });
  render(<WorkspaceDataTab />);
  fireEvent.click(screen.getByRole("button", { name: "Download JSON export" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not prepare",
  );
  expect(click).not.toHaveBeenCalled();
});
