import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import { accessApi } from "./access-api";

vi.mock("./api", () => ({ api: { request: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());

describe("operator error boundaries", () => {
  it("preserves the owner recovery reauthentication code", async () => {
    vi.mocked(api.request).mockRejectedValue({
      response: {
        status: 403,
        data: { error: "OPERATOR_REAUTH_REQUIRED" },
      },
    });
    await expect(accessApi.ownerSetup("company-1")).rejects.toMatchObject({
      status: 403,
      code: "OPERATOR_REAUTH_REQUIRED",
    });
  });

  it("preserves the partial-success password change code", async () => {
    vi.mocked(api.request).mockRejectedValue({
      response: {
        status: 503,
        data: { error: "PASSWORD_CHANGED_SIGN_IN_REQUIRED" },
      },
    });
    await expect(
      accessApi.changeOperatorPassword({
        currentPassword: "Current example passphrase",
        newPassword: "New example passphrase",
      }),
    ).rejects.toMatchObject({
      status: 503,
      code: "PASSWORD_CHANGED_SIGN_IN_REQUIRED",
    });
  });

  it("discards unrecognized server codes and messages", async () => {
    vi.mocked(api.request).mockRejectedValue({
      response: {
        status: 500,
        data: { error: "untrusted arbitrary code", message: "private detail" },
      },
    });
    await expect(accessApi.ownerSetup("company-1")).rejects.toMatchObject({
      status: 500,
      code: undefined,
      message: "Access request failed",
    });
  });
});
