import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import OperatorActivate from "./OperatorActivate";
import { accessApi, AccessError } from "@/lib/access-api";

vi.mock("@/lib/access-api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/access-api")>(
    "@/lib/access-api",
  )),
  accessApi: { activateOperator: vi.fn() },
}));
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fill() {
  change("Operator email", "operator@example.invalid");
  change("One-time setup code", "a".repeat(64));
  change("New password", "Local-example-password!");
  change("Confirm password", "Local-example-password!");
}
beforeEach(() => vi.resetAllMocks());
it("keeps setup codes in password inputs and rejects mismatched confirmation", async () => {
  render(<OperatorActivate />);
  fill();
  change("Confirm password", "Different-example-password!");
  expect(screen.getByLabelText("One-time setup code")).toHaveAttribute(
    "type",
    "password",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Set operator password" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("do not match");
  expect(accessApi.activateOperator).not.toHaveBeenCalled();
});
it("submits activation then removes secret fields and requires explicit login", async () => {
  vi.mocked(accessApi.activateOperator).mockResolvedValue({ success: true });
  render(<OperatorActivate />);
  fill();
  fireEvent.click(
    screen.getByRole("button", { name: "Set operator password" }),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Sign in to the console",
  );
  expect(accessApi.activateOperator).toHaveBeenCalledWith({
    email: "operator@example.invalid",
    setupCode: "a".repeat(64),
    password: "Local-example-password!",
  });
  expect(
    screen.queryByLabelText("One-time setup code"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Continue to operator login" }),
  ).toHaveAttribute("href", "/console/login");
});
it("clears submitted secrets after an unsuccessful activation without revealing backend details", async () => {
  vi.mocked(accessApi.activateOperator).mockRejectedValue(new AccessError(400));
  render(<OperatorActivate />);
  fill();
  fireEvent.click(
    screen.getByRole("button", { name: "Set operator password" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "expired or already been used",
  );
  await waitFor(() =>
    expect(screen.getByLabelText("One-time setup code")).toHaveValue(""),
  );
  expect(screen.getByLabelText("New password")).toHaveValue("");
  expect(screen.getByLabelText("Confirm password")).toHaveValue("");
});
