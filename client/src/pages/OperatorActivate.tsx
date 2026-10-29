import { useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import { accessApi, AccessError, passwordBytes } from "@/lib/access-api";

export default function OperatorActivate() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setError("");
    if (password.length < 12 || passwordBytes(password) > 72) {
      setError("Use at least 12 characters and no more than 72 UTF-8 bytes.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (!/^[a-f0-9]{64}$/.test(code.trim())) {
      setError(
        "Enter the complete setup code from your private environment settings.",
      );
      return;
    }
    setPending(true);
    try {
      await accessApi.activateOperator({
        email: email.trim(),
        setupCode: code.trim(),
        password,
      });
      setComplete(true);
    } catch (failure) {
      setError(
        failure instanceof AccessError && failure.status === 429
          ? "Too many setup attempts. Please wait and try again."
          : "Setup could not be completed. Check the email and code. The code may have expired or already been used; contact your platform administrator.",
      );
    } finally {
      setCode("");
      setPassword("");
      setConfirmation("");
      setPending(false);
    }
  }
  return (
    <AccessFrame
      title="Activate operator access"
      eyebrow="Private platform setup"
      actions={<a href="/console/login">Operator login</a>}
    >
      {complete ? (
        <Notice success>
          Your operator password is set. Sign in to the console to continue.
        </Notice>
      ) : (
        <>
          <p className="ez-muted">
            Use the operator email and private one-time setup code supplied
            through your secure environment settings. Codes expire after one
            hour. This page cannot create an operator account.
          </p>
          {error && <Notice>{error}</Notice>}
          <form className="ez-form" onSubmit={submit} aria-busy={pending}>
            <div className="ez-field">
              <label htmlFor="setup-operator-email">Operator email</label>
              <input
                id="setup-operator-email"
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
              <label htmlFor="operator-setup-code">One-time setup code</label>
              <input
                id="operator-setup-code"
                name="setupCode"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={64}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={pending}
                aria-describedby="operator-code-help"
              />
              <small id="operator-code-help">
                Keep this code private. Do not put it in a URL, email or chat
                message.
              </small>
            </div>
            <div className="ez-field">
              <label htmlFor="operator-setup-password">New password</label>
              <input
                id="operator-setup-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={72}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
                aria-describedby="operator-new-password-help"
              />
              <small id="operator-new-password-help">
                At least 12 characters; maximum 72 UTF-8 bytes.
              </small>
            </div>
            <div className="ez-field">
              <label htmlFor="operator-setup-confirm">Confirm password</label>
              <input
                id="operator-setup-confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={72}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={pending}
              />
            </div>
            <button
              type="submit"
              className="ez-button ez-button--primary"
              disabled={pending}
            >
              {pending ? "Activating…" : "Set operator password"}
            </button>
          </form>
        </>
      )}
      <p className="ez-help ez-section">
        <a href="/console/login">Continue to operator login</a>
      </p>
    </AccessFrame>
  );
}
