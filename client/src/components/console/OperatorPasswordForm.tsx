import { useState, type FormEvent } from "react";
import { Notice } from "./AccessFrame";
import {
  AccessError,
  accessApi,
  accessErrorMessage,
  passwordBytes,
} from "@/lib/access-api";

export function OperatorPasswordForm({
  disabled,
  onSignInRequired,
  onPendingChange,
}: {
  disabled: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSignInRequired: (message: string) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || disabled) return;
    setError("");
    setSuccess(false);
    if (
      newPassword.length < 12 ||
      passwordBytes(newPassword) > 72 ||
      passwordBytes(currentPassword) > 72
    ) {
      setError(
        "Use at least 12 characters and no more than 72 UTF-8 bytes for your new password.",
      );
      return;
    }
    if (newPassword !== confirmation) {
      setError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Choose a different password from your current one.");
      return;
    }
    setPending(true);
    onPendingChange?.(true);
    try {
      await accessApi.changeOperatorPassword({ currentPassword, newPassword });
      setSuccess(true);
    } catch (failure) {
      if (failure instanceof AccessError) {
        if (failure.code === "PASSWORD_CHANGED_SIGN_IN_REQUIRED") {
          onSignInRequired(
            "Your password was changed. Sign in again using your new password.",
          );
          return;
        }
        if (
          failure.status === 401 ||
          failure.code === "OPERATOR_CREDENTIALS_CHANGED"
        ) {
          onSignInRequired(
            "Your operator session has changed. Sign in again before changing your password.",
          );
          return;
        }
        if (failure.code === "CURRENT_PASSWORD_INVALID") {
          setError("Your current password could not be verified. Try again.");
          return;
        }
        if (failure.code === "PASSWORD_UNCHANGED") {
          setError("Choose a different password from your current one.");
          return;
        }
      }
      setError(accessErrorMessage(failure));
    } finally {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <section
      className="ez-card ez-section"
      aria-labelledby="operator-security-heading"
    >
      <h2 id="operator-security-heading">Operator account security</h2>
      <details>
        <summary>Change your password</summary>
        <p className="ez-help">
          Changing your password signs out your other operator sessions. This
          session stays signed in. Company passwords are managed separately.
        </p>
        {error && <Notice>{error}</Notice>}
        {success && (
          <Notice success>
            Password changed. Your other operator sessions have been signed out.
          </Notice>
        )}
        <form className="ez-form" onSubmit={submit} aria-busy={pending}>
          <div className="ez-field">
            <label htmlFor="operator-current-password">Current password</label>
            <input
              id="operator-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={pending || disabled}
            />
          </div>
          <div className="ez-field">
            <label htmlFor="operator-new-password">New password</label>
            <input
              id="operator-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              disabled={pending || disabled}
              aria-describedby="operator-password-help"
            />
            <small id="operator-password-help">
              Use at least 12 characters, up to 72 UTF-8 bytes. A long, unique
              passphrase works well.
            </small>
          </div>
          <div className="ez-field">
            <label htmlFor="operator-confirm-password">
              Confirm new password
            </label>
            <input
              id="operator-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={pending || disabled}
            />
          </div>
          <button
            className="ez-button"
            type="submit"
            disabled={pending || disabled}
          >
            {pending ? "Changing password…" : "Save new password"}
          </button>
        </form>
      </details>
    </section>
  );
}
