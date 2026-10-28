import { useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import {
  accessApi,
  accessErrorMessage,
  navigateTo,
  passwordBytes,
} from "@/lib/access-api";
export default function ConsoleLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
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
      await accessApi.operatorLogin({ email: email.trim(), password });
      setPassword("");
      navigateTo("/console/tenants");
    } catch (failure) {
      setError(accessErrorMessage(failure, true));
    } finally {
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
      {error && <Notice>{error}</Notice>}
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
      <p className="ez-help ez-section">
        Operator access is provisioned privately. There is no public console
        signup.
      </p>
    </AccessFrame>
  );
}
