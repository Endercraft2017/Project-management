import { useEffect, useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import {
  accessApi,
  accessErrorMessage,
  navigateTo,
  passwordBytes,
  validTenantCode,
  type Capabilities,
} from "@/lib/access-api";

export default function TenantLogin() {
  const params = new URLSearchParams(window.location.search);
  const preset = params.get("tenantCode") || "";
  const [tenantCode, setTenantCode] = useState(
    validTenantCode(preset.toUpperCase()) ? preset.toUpperCase() : "",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const callbackError = ["auth_failed", "session_failed"].includes(
    params.get("error") || "",
  );
  useEffect(() => {
    let live = true;
    accessApi
      .capabilities()
      .then((data) => {
        if (live) setCapabilities(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!validTenantCode(tenantCode)) {
      setError(
        "Enter the company code provided by your administrator, for example A0000Z.",
      );
      return;
    }
    if (passwordBytes(password) > 72) {
      setError("The password is too long. Use no more than 72 UTF-8 bytes.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await accessApi.login({ tenantCode, email: email.trim(), password });
      setPassword("");
      navigateTo("/app");
    } catch (failure) {
      setError(accessErrorMessage(failure, true));
    } finally {
      setPending(false);
    }
  }
  function googleLogin() {
    if (!capabilities?.googleEnabled) return;
    if (!validTenantCode(tenantCode)) {
      setError("Enter your company code before continuing with Google.");
      return;
    }
    navigateTo(`/api/auth/google?tenantCode=${encodeURIComponent(tenantCode)}`);
  }
  return (
    <AccessFrame title="Log in to your workspace" eyebrow="Company access">
      <p className="ez-muted">
        Your company code keeps your sign-in connected to the right team.
      </p>
      {params.get("activated") === "1" && (
        <Notice success>
          Your password is ready. Log in with your company code and email.
        </Notice>
      )}
      {callbackError && (
        <Notice>
          Sign-in did not complete. Please try again or contact your
          administrator.
        </Notice>
      )}
      {params.get("error") === "google_disabled" && (
        <Notice>
          Use your company code, email and password below to log in.
        </Notice>
      )}
      {error && <Notice>{error}</Notice>}
      {capabilities?.passwordEnabled === false && (
        <Notice>
          Company sign-in is currently unavailable. Contact your administrator.
        </Notice>
      )}
      <form className="ez-form" onSubmit={submit} aria-busy={pending}>
        <div className="ez-field">
          <label htmlFor="tenant-code">Company code</label>
          <input
            id="tenant-code"
            name="tenantCode"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="A0000Z"
            maxLength={6}
            required
            value={tenantCode}
            onChange={(e) =>
              setTenantCode(e.target.value.replace(/\s/g, "").toUpperCase())
            }
            disabled={pending}
            aria-describedby="tenant-code-help"
          />
          <small id="tenant-code-help">
            Use the six-character code from your administrator.
          </small>
        </div>
        <div className="ez-field">
          <label htmlFor="tenant-email">Email address</label>
          <input
            id="tenant-email"
            name="email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="ez-field">
          <label htmlFor="tenant-password">Password</label>
          <input
            id="tenant-password"
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
          disabled={pending || capabilities?.passwordEnabled === false}
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      {capabilities?.googleEnabled && (
        <>
          <div className="ez-login-divider">or</div>
          <button
            className="ez-button ez-button--full"
            type="button"
            onClick={googleLogin}
            disabled={pending}
          >
            Sign in with Google
          </button>
          <p className="ez-help">Google sign-in uses the company code above.</p>
        </>
      )}
      <p className="ez-help ez-section">
        Need access or a password reset? Contact your company administrator.
        There is no public account registration.
      </p>
      <a href="/" className="ez-help">
        Explore the product tour
      </a>
    </AccessFrame>
  );
}
