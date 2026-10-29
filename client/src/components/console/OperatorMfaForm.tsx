import { useEffect, useState, type FormEvent } from "react";
import { accessApi, AccessError, accessErrorMessage } from "@/lib/access-api";
import { Notice } from "./AccessFrame";

export function OperatorMfaForm({
  disabled,
  onSignInRequired,
}: {
  disabled: boolean;
  onSignInRequired: (notice: string) => void;
}) {
  const [status, setStatus] = useState<{
    configured: boolean;
    enabled: boolean;
  } | null>(null);
  const [loadError, setLoadError] = useState(false),
    [pending, setPending] = useState(false);
  const [password, setPassword] = useState(""),
    [token, setToken] = useState("");
  const [secret, setSecret] = useState(""),
    [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [mustSignIn, setMustSignIn] = useState(false);
  useEffect(() => {
    let active = true;
    accessApi
      .operatorMfa()
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || disabled || !status) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (status.enabled) {
        const result = await accessApi.disableOperatorMfa(
          password,
          token.trim(),
        );
        setStatus({ ...status, enabled: false });
        if (result.signInRequired) {
          onSignInRequired(
            "MFA was disabled. Sign in again with your password.",
          );
          return;
        }
        setNotice(
          "Authenticator protection was disabled. Your other operator sessions were signed out.",
        );
      } else if (secret) {
        const result = await accessApi.enableOperatorMfa(token.trim());
        setSecret("");
        setCodes(result.recoveryCodes);
        setMustSignIn(result.signInRequired);
        setStatus({ ...status, enabled: true });
        setNotice(
          "MFA is enabled. Save your recovery codes privately now; they are shown only once.",
        );
      } else {
        const result = await accessApi.beginOperatorMfa(password);
        setSecret(result.secret);
      }
    } catch (failure) {
      if (failure instanceof AccessError && failure.status === 401) {
        onSignInRequired("Sign in again to manage your authenticator.");
        return;
      }
      setError(
        failure instanceof AccessError &&
          failure.code === "CURRENT_PASSWORD_INVALID"
          ? "Your current password could not be verified."
          : accessErrorMessage(failure) +
              " Check your code or start setup again if it expired.",
      );
    } finally {
      setPassword("");
      setToken("");
      setPending(false);
    }
  }
  return (
    <section
      className="ez-card ez-section"
      aria-labelledby="operator-mfa-heading"
    >
      <h2 id="operator-mfa-heading">Authenticator protection</h2>
      {!status ? (
        <p className="ez-help">
          {loadError
            ? "MFA status is unavailable. Refresh the console to retry."
            : "Checking authenticator status…"}
        </p>
      ) : (
        <>
          <p className="ez-help">
            {status.enabled
              ? "MFA is enabled for this operator."
              : "Add a second sign-in step using a free authenticator app. Enrollment is optional."}
          </p>
          {error && <Notice>{error}</Notice>}
          {notice && <Notice success>{notice}</Notice>}
          {codes.length > 0 ? (
            <div className="ez-field">
              <label htmlFor="operator-recovery-codes">
                One-use recovery codes
              </label>
              <textarea
                id="operator-recovery-codes"
                rows={10}
                readOnly
                value={codes.join("\n")}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="ez-help">
                Store these separately from your authenticator, in a trusted
                password manager or secure offline location. Each code works
                once and still requires your password. Never send them in chat.
              </p>
              {mustSignIn && (
                <p className="ez-help">
                  Your protection changed, but this session could not be
                  renewed. Save the codes, then sign in again.
                </p>
              )}
              <button
                type="button"
                className="ez-button"
                onClick={() => {
                  setCodes([]);
                  if (mustSignIn)
                    onSignInRequired(
                      "MFA is enabled. Sign in again with your password and a fresh authenticator or recovery code.",
                    );
                }}
              >
                I saved my recovery codes
              </button>
            </div>
          ) : !status.configured ? (
            <p className="ez-help">
              The platform operator must configure the protected MFA encryption
              key before authenticator changes are available. Enabled accounts
              remain protected.
            </p>
          ) : (
            <details>
              <summary>
                {status.enabled
                  ? "Disable authenticator protection"
                  : "Set up an authenticator"}
              </summary>
              <form className="ez-form" onSubmit={submit} aria-busy={pending}>
                {secret ? (
                  <div className="ez-field">
                    <p className="ez-help">
                      In your authenticator app, add a time-based account named
                      E-Z operator console, using the key below (6 digits,
                      30-second period). Confirm within 10 minutes. Keep this
                      key private.
                    </p>
                    <label htmlFor="operator-authenticator-secret">
                      Authenticator setup key
                    </label>
                    <input
                      id="operator-authenticator-secret"
                      readOnly
                      value={secret}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="ez-field">
                    <label htmlFor="operator-mfa-password">
                      Current password for authenticator changes
                    </label>
                    <input
                      id="operator-mfa-password"
                      type="password"
                      required
                      maxLength={72}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={pending || disabled}
                    />
                  </div>
                )}
                {(secret || status.enabled) && (
                  <div className="ez-field">
                    <label htmlFor="operator-mfa-confirm">
                      {status.enabled
                        ? "Fresh authenticator or recovery code"
                        : "Six-digit authenticator code"}
                    </label>
                    <input
                      id="operator-mfa-confirm"
                      required
                      minLength={6}
                      maxLength={64}
                      autoComplete="one-time-code"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      disabled={pending || disabled}
                    />
                    <small>
                      Codes are single-use. If you just enrolled or signed in,
                      wait for the next code before another action.
                    </small>
                  </div>
                )}
                <button
                  type="submit"
                  className="ez-button"
                  disabled={pending || disabled}
                >
                  {pending
                    ? "Updating…"
                    : status.enabled
                      ? "Disable MFA"
                      : secret
                        ? "Confirm and enable MFA"
                        : "Create setup key"}
                </button>
                {secret && (
                  <button
                    type="button"
                    className="ez-button"
                    disabled={pending}
                    onClick={() => {
                      setSecret("");
                      setToken("");
                      setError("");
                    }}
                  >
                    Cancel setup
                  </button>
                )}
              </form>
            </details>
          )}
        </>
      )}
    </section>
  );
}
