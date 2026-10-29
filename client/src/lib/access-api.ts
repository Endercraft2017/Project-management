import { api } from "./api";

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  status?: string;
}
export interface LoginUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  picture?: string;
}
export interface OperatorUser {
  id: string;
  email: string;
  name: string;
}
export interface PublicTenant extends TenantSummary {
  status: "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "FAILED";
  ownerEmail: string;
  ownerName: string;
  storageLimitBytes: number;
  storageBytesUsed: number;
  seatLimit: number;
  aiTokenLimit: number;
  aiTokensUsed: number;
  createdAt: string;
  updatedAt: string;
}
export interface AuditRecord {
  id: string;
  tenantId: string | null;
  operatorId: string | null;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
export interface Capabilities {
  passwordEnabled: boolean;
  googleEnabled: boolean;
}
export interface TenantInput {
  name: string;
  ownerEmail: string;
  ownerName: string;
  storageLimitBytes?: number;
  seatLimit?: number;
  aiTokenLimit?: number;
}
const operatorErrorCodes = [
  "OPERATOR_REAUTH_REQUIRED",
  "CURRENT_PASSWORD_INVALID",
  "PASSWORD_UNCHANGED",
  "OPERATOR_CREDENTIALS_CHANGED",
  "PASSWORD_CHANGED_SIGN_IN_REQUIRED",
] as const;
type OperatorErrorCode = (typeof operatorErrorCodes)[number];
function operatorErrorCode(value: unknown): OperatorErrorCode | undefined {
  return operatorErrorCodes.find((code) => code === value);
}
export class AccessError extends Error {
  constructor(
    public status: number,
    public code?: OperatorErrorCode,
  ) {
    super("Access request failed");
  }
}

async function request<T>(
  method: "get" | "post" | "patch",
  path: string,
  data?: unknown,
): Promise<T> {
  try {
    const response = await api.request<T & { success: boolean }>({
      method,
      url: path,
      data,
    });
    if (!response.data.success)
      throw new AccessError(
        response.status,
        operatorErrorCode((response.data as { error?: unknown }).error),
      );
    return response.data;
  } catch (error) {
    if (error instanceof AccessError) throw error;
    const response = (
      error as {
        response?: { status?: number; data?: { error?: unknown } };
      }
    )?.response;
    throw new AccessError(
      response?.status || 0,
      operatorErrorCode(response?.data?.error),
    );
  }
}
export const accessApi = {
  capabilities: () => request<Capabilities>("get", "/api/auth/capabilities"),
  login: (input: { tenantCode: string; email: string; password: string }) =>
    request<{ user: LoginUser; tenant: TenantSummary }>(
      "post",
      "/api/auth/login",
      input,
    ),
  activate: (input: { tenantCode: string; token: string; password: string }) =>
    request<{ user: LoginUser; tenant: TenantSummary }>(
      "post",
      "/api/auth/activate",
      input,
    ),
  operatorLogin: (input: { email: string; password: string }) =>
    request<{ user: OperatorUser }>("post", "/api/console/login", input),
  operatorMe: () => request<{ user: OperatorUser }>("get", "/api/console/me"),
  operatorLogout: () => request("post", "/api/console/logout"),
  changeOperatorPassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => request("post", "/api/console/password", input),
  tenants: async () =>
    (await request<{ data: PublicTenant[] }>("get", "/api/console/tenants"))
      .data,
  audit: async () =>
    (await request<{ data: AuditRecord[] }>("get", "/api/console/audit")).data,
  createTenant: (input: TenantInput) =>
    request<{ data: PublicTenant; setupUrl: string }>(
      "post",
      "/api/console/tenants",
      input,
    ),
  ownerSetup: (id: string) =>
    request<{ data: PublicTenant; setupUrl: string; expiresInSeconds: number }>(
      "post",
      `/api/console/tenants/${encodeURIComponent(id)}/owner-setup`,
      {},
    ),
  updateTenant: async (
    id: string,
    input: {
      name?: string;
      status?: string;
      storageLimitBytes?: number;
      seatLimit?: number;
      aiTokenLimit?: number;
    },
  ) =>
    (
      await request<{ data: PublicTenant }>(
        "patch",
        `/api/console/tenants/${encodeURIComponent(id)}`,
        input,
      )
    ).data,
};
export function accessErrorMessage(error: unknown, login = false): string {
  const status = error instanceof AccessError ? error.status : 0;
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (login && status >= 400 && status < 500)
    return "The sign-in details could not be verified. Check them and try again.";
  return "We could not complete that request. Please try again.";
}
export function navigateTo(path: string) {
  window.location.assign(path);
}
export const passwordBytes = (password: string) =>
  new TextEncoder().encode(password).length;
export const validTenantCode = (code: string) =>
  /^[A-Z][0-9]{4}[A-Z]$/.test(code);
