import type { Request, Response, NextFunction } from "express";
import { getTenantById } from "@/platform/store";
import { getTenantContext, runWithTenant } from "@/tenancy/context";
import { sessionConfig } from "@/config";

export const publicAuthPaths = new Set([
  "/api/auth/login",
  "/api/auth/activate",
  "/api/auth/capabilities",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/auth/drive/status",
]);

export function skipsSessionIdentity(req: Request): boolean {
  return (
    publicAuthPaths.has(req.path) ||
    req.path.startsWith("/api/auth/google/") ||
    req.path === "/api/auth/logout"
  );
}

export async function sessionTenantContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // An old tab must not reuse a newly selected company's cookie. This is a
  // consistency assertion, never a source of tenant authority.
  if (
    req.session.passport?.user &&
    !publicAuthPaths.has(req.path) &&
    !req.path.startsWith("/api/auth/google/")
  ) {
    if (
      typeof req.session.workspaceContext !== "string" ||
      !req.session.workspaceContext
    ) {
      req.session.destroy(() => {});
      res
        .status(401)
        .json({
          success: false,
          error: "SESSION_EXPIRED",
          message: "Sign in again to your workspace",
        });
      return;
    }
    const expected =
      req.get("X-EZ-Workspace") ||
      (req.method === "GET" &&
      req.path.startsWith("/api/upload/download/") &&
      typeof req.query.workspaceContext === "string"
        ? req.query.workspaceContext
        : undefined);
    const bootstrap =
      req.path === "/api/auth/me" || req.path === "/api/auth/check";
    if ((!bootstrap || expected) && expected !== req.session.workspaceContext) {
      res.status(409).json({
        success: false,
        error: "WORKSPACE_SESSION_CHANGED",
        message: "Your sign-in changed in another tab. Reload to continue.",
      });
      return;
    }
  }
  if (skipsSessionIdentity(req)) return next();
  if (!req.session.tenantId) {
    if (req.session.passport?.user) {
      req.session.destroy(() => {});
      res.status(401).json({
        success: false,
        error: "SESSION_EXPIRED",
        message: "Sign in again to an active workspace",
      });
      return;
    }
    return next();
  }
  try {
    const tenant = await getTenantById(req.session.tenantId);
    if (
      !tenant ||
      tenant.status !== "ACTIVE" ||
      !req.session.issuedAt ||
      Date.now() - req.session.issuedAt > sessionConfig.maxAge
    ) {
      req.session.destroy(() => {});
      res.status(401).json({
        success: false,
        error: "SESSION_EXPIRED",
        message: "Sign in again to an active workspace",
      });
      return;
    }
    runWithTenant(tenant, next);
  } catch (error) {
    next(error);
  }
}

export function currentTenantDto() {
  const tenant = getTenantContext();
  return { id: tenant.id, code: tenant.code, name: tenant.name };
}
