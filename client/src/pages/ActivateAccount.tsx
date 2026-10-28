import { useEffect, useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import {
  accessApi,
  navigateTo,
  passwordBytes,
  validTenantCode,
  AccessError,
} from "@/lib/access-api";
export default function ActivateAccount() {
  const params = new URLSearchParams(window.location.search);
  const tenantCode = (params.get("tenantCode") || "").toUpperCase();
  // Keep the one-use token only in memory; remove it from history/referrers immediately.
  const [token] = useState(() => params.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const valid = validTenantCode(tenantCode) && Boolean(token);
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !valid) return;
    if (password.length < 12 || passwordBytes(password) > 72) {
      setError("Use at least 12 characters and no more than 72 UTF-8 bytes.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await accessApi.activate({ tenantCode, token, password });
      setPassword("");
      setConfirmation("");
      navigateTo(
        `/login?tenantCode=${encodeURIComponent(tenantCode)}&activated=1`,
      );
    } catch (failure) {
      setError(
        failure instanceof AccessError && failure.status === 429
          ? "Too many attempts. Please wait and try again."
          : "This setup link could not be used. It may be invalid, expired or already used. Ask your E-Z operator for a new link.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <AccessFrame
      title="Set up your account"
      eyebrow="One-time owner activation"
    >
      {valid ? (
        <>
          <p className="ez-muted">
            Choose a password for company <strong>{tenantCode}</strong>.
            Completing setup does not sign you in automatically.
          </p>
          {error && <Notice>{error}</Notice>}
          <form className="ez-form" onSubmit={submit} aria-busy={pending}>
            <div className="ez-field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                aria-describedby="password-policy"
              />
              <small id="password-policy">
                At least 12 characters; maximum 72 UTF-8 bytes.
              </small>
            </div>
            <div className="ez-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={pending}
              />
            </div>
            <button
              className="ez-button ez-button--primary"
              type="submit"
              disabled={pending}
            >
              {pending ? "Setting password…" : "Set password"}
            </button>
          </form>
        </>
      ) : (
        <Notice>
          This setup link is incomplete. Ask your E-Z operator for a new link.
        </Notice>
      )}
      <p className="ez-help ez-section">
        <a href="/login">Already activated? Log in</a>
      </p>
    </AccessFrame>
  );
}
