import { useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import {
  accessApi,
  accessErrorMessage,
  navigateTo,
  passwordBytes,
} from "@/lib/access-api";
export default function ConsoleLogin({ notice }: { notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [token, setToken] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (passwordBytes(password) > 72) {
      setError("The password is too long.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await accessApi.operatorLogin({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (result.mfaRequired) {
        setChallenge(true);
        return;
      }
      navigateTo("/console/tenants");
    } catch (failure) {
      setError(accessErrorMessage(failure, true));
    } finally {
      setPending(false);
    }
  }
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await accessApi.verifyOperatorMfa(token.trim());
      navigateTo("/console/tenants");
    } catch {
      setError(
        "The code could not be verified. Use a fresh authenticator code or an unused recovery code; sign in again if this step expired. After repeated attempts, wait five minutes.",
      );
    } finally {
      setToken("");
      setPending(false);
    }
  }
  return (
    <AccessFrame
      title="Operator console"
      eyebrow="E-Z platform access"
      actions={<a href="/login">Company login</a>}
    >
      <p className="ez-muted">
        Manage company workspaces with your operator account. Company
        administrators do not have console access.
      </p>
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice>{error}</Notice>}
      {challenge ? (
        <form className="ez-form" onSubmit={verify} aria-busy={pending}>
          <p className="ez-help">
            Enter your six-digit authenticator code or an unused recovery code.
            This step expires after five minutes. Codes are single-use; after
            enrollment or sign-in, wait for the next authenticator code.
          </p>
          <div className="ez-field">
            <label htmlFor="operator-mfa-token">
              Authenticator or recovery code
            </label>
            <input
              id="operator-mfa-token"
              autoComplete="one-time-code"
              required
              maxLength={64}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={pending}
            />
          </div>
          <button
            className="ez-button ez-button--primary ez-button--full"
            type="submit"
            disabled={pending}
          >
            {pending ? "Verifying…" : "Verify code"}
          </button>
          <button
            className="ez-button"
            type="button"
            disabled={pending}
            onClick={() => {
              setChallenge(false);
              setToken("");
              setError("");
            }}
          >
            Start sign-in again
          </button>
        </form>
      ) : (
        <form className="ez-form" onSubmit={submit} aria-busy={pending}>
          <div className="ez-field">
            <label htmlFor="operator-email">Operator email</label>
            <input
              id="operator-email"
              name="email"
              type="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="ez-field">
            <label htmlFor="operator-password">Password</label>
            <input
              id="operator-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={pending}
            />
          </div>
          <button
            className="ez-button ez-button--primary ez-button--full"
            type="submit"
            disabled={pending}
          >
            {pending ? "Logging in…" : "Log in to console"}
          </button>
        </form>
      )}
      <p className="ez-help ez-section">
        Operator access is provisioned privately. There is no public console
        signup.
      </p>
    </AccessFrame>
  );
}
