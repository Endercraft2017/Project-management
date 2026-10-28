import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import MessageInput from "./MessageInput";
const fixture = vi.hoisted(() => ({
  send: vi.fn(),
  emit: vi.fn(),
  connected: true,
}));
vi.mock("@/hooks/useMessages", () => ({
  useSendMessage: () => ({ mutateAsync: fixture.send }),
}));
vi.mock("@/lib/socket", () => ({
  getSocket: () => ({
    connected: fixture.connected,
    timeout: () => ({ emit: fixture.emit }),
  }),
}));
vi.mock("emoji-picker-react", () => ({ default: () => null }));
vi.mock("./MentionInputV2", () => ({
  default: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
  }) => (
    <input
      aria-label="Draft"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  fixture.connected = true;
});
it("keeps a failed draft, blocks duplicate sends while pending, and clears only after success", async () => {
  let fail!: (error: Error) => void;
  fixture.send.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
  );
  render(<MessageInput conversationId="company-chat" />);
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  expect(fixture.send).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Draft")).toHaveValue("Keep this draft");
  fail(new Error("Offline"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your draft is still here",
  );
  expect(screen.getByLabelText("Draft")).toHaveValue("Keep this draft");
  fixture.send.mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await waitFor(() => expect(screen.getByLabelText("Draft")).toHaveValue(""));
});
it("retains an edit after timeout and closes editing only after a positive acknowledgement", async () => {
  const cancel = vi.fn();
  fixture.emit.mockImplementationOnce((_event, _data, callback) =>
    callback(new Error("timeout")),
  );
  render(
    <MessageInput
      conversationId="chat"
      editingMessage={{ id: "message", content: "Original" }}
      onCancelEdit={cancel}
    />,
  );
  fireEvent.change(screen.getByLabelText("Draft"), {
    target: { value: "Correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save message" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Confirmation timed out",
  );
  expect(screen.getByLabelText("Draft")).toHaveValue("Correction");
  expect(cancel).not.toHaveBeenCalled();
  fixture.emit.mockImplementationOnce((_event, _data, callback) =>
    callback(null, { success: true }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Save message" }));
  await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
});
it("a late send acknowledgement cannot clear the next conversation draft", async () => {
  let finish!: () => void;
  fixture.send.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<MessageInput conversationId="a" />);
  fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "A" } });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  view.rerender(<MessageInput conversationId="b" />);
  fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "B" } });
  finish();
  await waitFor(() => expect(screen.getByLabelText("Draft")).toHaveValue("B"));
});
