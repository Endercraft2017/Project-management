import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import { OperatorPasswordForm } from "@/components/console/OperatorPasswordForm";
import ConsoleLogin from "./ConsoleLogin";
import {
  accessApi,
  AccessError,
  accessErrorMessage,
  navigateTo,
  type OperatorUser,
  type PublicTenant,
  type AuditRecord,
  type TenantInput,
} from "@/lib/access-api";

const MIB = 1024 * 1024;
function nonnegative(value: string) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error("Invalid limit");
  return number;
}
function bytes(value: number) {
  return `${(Number(value) / MIB).toLocaleString(undefined, { maximumFractionDigits: 2 })} MiB`;
}
function TenantLimits({
  tenant,
  pending,
  onSave,
}: {
  tenant: PublicTenant;
  pending: boolean;
  onSave: (
    id: string,
    patch: {
      name: string;
      storageLimitBytes: number;
      aiTokenLimit: number;
      seatLimit: number;
    },
  ) => Promise<void>;
}) {
  const [name, setName] = useState(tenant.name);
  const [storage, setStorage] = useState(
    String(tenant.storageLimitBytes / MIB),
  );
  const [ai, setAI] = useState(String(tenant.aiTokenLimit));
  const [seats, setSeats] = useState(String(tenant.seatLimit));
  const [error, setError] = useState("");
  useEffect(() => {
    setName(tenant.name);
    setStorage(String(tenant.storageLimitBytes / MIB));
    setAI(String(tenant.aiTokenLimit));
    setSeats(String(tenant.seatLimit));
  }, [
    tenant.name,
    tenant.storageLimitBytes,
    tenant.aiTokenLimit,
    tenant.seatLimit,
  ]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const value = nonnegative(storage) * MIB;
      if (!Number.isSafeInteger(value)) throw new Error();
      await onSave(tenant.id, {
        name: name.trim(),
        storageLimitBytes: value,
        aiTokenLimit: nonnegative(ai),
        seatLimit: nonnegative(seats),
      });
    } catch {
      setError("Use whole non-negative numbers for limits.");
    }
  }
  return (
    <details>
      <summary>Manage limits</summary>
      <form className="ez-limit-form" onSubmit={submit} aria-busy={pending}>
        <div className="ez-field">
          <label htmlFor={`name-${tenant.id}`}>Company display name</label>
          <input
            id={`name-${tenant.id}`}
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="ez-field">
          <label htmlFor={`storage-${tenant.id}`}>Storage limit (MiB)</label>
          <input
            id={`storage-${tenant.id}`}
            type="number"
            min="0"
            step="1"
            required
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            disabled={pending}
          />
        </div>
        <div className="ez-field">
          <label htmlFor={`seats-${tenant.id}`}>Account slot limit</label>
          <input
            id={`seats-${tenant.id}`}
            type="number"
            min="1"
            max="10000"
            step="1"
            required
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            disabled={pending}
            aria-describedby={`seats-help-${tenant.id}`}
          />
          <small id={`seats-help-${tenant.id}`}>
            Includes active and pending accounts. Reducing the cap does not
            remove existing accounts; new accounts need an available slot.
          </small>
        </div>
        <div className="ez-field">
          <label htmlFor={`ai-${tenant.id}`}>AI token allowance</label>
          <input
            id={`ai-${tenant.id}`}
            type="number"
            min="0"
            step="1"
            required
            value={ai}
            onChange={(e) => setAI(e.target.value)}
            disabled={pending}
          />
          <small>
            Cumulative allowance, with no monthly reset. Zero disables AI. This
            does not configure or enable an AI provider.
          </small>
        </div>
        {error && <Notice>{error}</Notice>}
        <button type="submit" className="ez-button" disabled={pending}>
          {pending ? "Saving…" : "Save limits"}
        </button>
      </form>
    </details>
  );
}

export default function ConsoleTenants() {
  const [session, setSession] = useState<
    "loading" | "ready" | "anonymous" | "error"
  >("loading");
  const [operator, setOperator] = useState<OperatorUser | null>(null);
  const [signInNotice, setSignInNotice] = useState("");
  const [tenants, setTenants] = useState<PublicTenant[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [storage, setStorage] = useState("100");
  const [ai, setAI] = useState("0");
  const [seats, setSeats] = useState("10");
  const [setup, setSetup] = useState<{
    code: string;
    url: string;
    recovery?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const setupHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let live = true;
    accessApi
      .operatorMe()
      .then(async (result) => {
        if (!live) return;
        if (!result.user?.id) throw new AccessError(401);
        setOperator(result.user);
        setSession("ready");
        setLoading(true);
        const [data, entries] = await Promise.all([
          accessApi.tenants(),
          accessApi.audit(),
        ]);
        if (live) {
          setTenants(data);
          setAudit(entries);
        }
      })
      .catch((failure) => {
        if (!live) return;
        if (
          failure instanceof AccessError &&
          (failure.status === 401 || failure.status === 403)
        ) {
          setSession("anonymous");
        } else {
          setSession("error");
          setLoadError("The console could not be loaded. Please retry.");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (setup) setupHeading.current?.focus();
  }, [setup]);
  function requireSignIn(message: string) {
    setTenants([]);
    setAudit([]);
    setSetup(null);
    setOperator(null);
    setSignInNotice(message);
    setSession("anonymous");
  }
  function failure(error: unknown) {
    if (
      error instanceof AccessError &&
      (error.status === 401 || error.status === 403)
    ) {
      requireSignIn(
        error.code === "OPERATOR_REAUTH_REQUIRED"
          ? "Sign in again before issuing an owner recovery link. No reset link has been issued."
          : "Your operator session has ended. Sign in again to continue.",
      );
    } else setActionError(accessErrorMessage(error));
  }
  async function refresh() {
    setLoading(true);
    setLoadError("");
    try {
      const [data, entries] = await Promise.all([
        accessApi.tenants(),
        accessApi.audit(),
      ]);
      setTenants(data);
      setAudit(entries);
    } catch (error) {
      if (
        error instanceof AccessError &&
        (error.status === 401 || error.status === 403)
      )
        failure(error);
      else
        setLoadError(
          "The latest company data could not be loaded. Retry before making changes.",
        );
    } finally {
      setLoading(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setActionError("");
    setNotice("");
    let input: TenantInput;
    try {
      const limit = nonnegative(storage) * MIB;
      if (!Number.isSafeInteger(limit)) throw new Error();
      input = {
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        storageLimitBytes: limit,
        aiTokenLimit: nonnegative(ai),
        seatLimit: nonnegative(seats),
      };
    } catch {
      setActionError("Use whole non-negative numbers for limits.");
      return;
    }
    setBusy("create");
    try {
      const result = await accessApi.createTenant(input);
      const url = new URL(result.setupUrl, window.location.origin);
      if (
        url.origin === window.location.origin &&
        url.pathname === "/activate" &&
        url.searchParams.get("tenantCode") === result.data.code &&
        url.searchParams.get("token")
      ) {
        setSetup({ code: result.data.code, url: url.href });
        setCopied(false);
      } else {
        setNotice(
          "Company created, but the setup link was unavailable. Contact the platform operator before retrying creation.",
        );
      }
      setName("");
      setOwnerName("");
      setOwnerEmail("");
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      setBusy(null);
    }
  }
  async function update(
    id: string,
    patch: {
      name?: string;
      status?: string;
      storageLimitBytes?: number;
      aiTokenLimit?: number;
      seatLimit?: number;
    },
  ) {
    if (busy) return;
    setBusy(id);
    setActionError("");
    setNotice("");
    try {
      await accessApi.updateTenant(id, patch);
      setNotice("Company settings saved.");
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      setBusy(null);
    }
  }
  async function logout() {
    setBusy("logout");
    setActionError("");
    try {
      await accessApi.operatorLogout();
      setSetup(null);
      setTenants([]);
      setAudit([]);
      navigateTo("/console/login");
    } catch (error) {
      failure(error);
    } finally {
      setBusy(null);
    }
  }
  async function recoverOwner(tenant: PublicTenant) {
    if (busy || setup) return;
    setBusy(tenant.id);
    setActionError("");
    setNotice("");
    try {
      const result = await accessApi.ownerSetup(tenant.id);
      const url = new URL(result.setupUrl, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== "/activate" ||
        url.searchParams.get("tenantCode") !== tenant.code ||
        !url.searchParams.get("token")
      ) {
        setNotice(
          "The recovery request completed, but the link could not be shown. Sign in again before requesting a replacement.",
        );
        return;
      }
      setSetup({ code: tenant.code, url: url.href, recovery: true });
      setCopied(false);
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      setBusy(null);
    }
  }
  async function copySetup() {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.url);
      setCopied(true);
    } catch {
      setCopied(false);
      setNotice(
        "Clipboard access is unavailable. Select and copy the setup link manually.",
      );
    }
  }
  if (session === "anonymous") return <ConsoleLogin notice={signInNotice} />;
  if (session === "loading")
    return (
      <AccessFrame title="Operator console" eyebrow="Verifying your session">
        <p className="ez-loading" role="status">
          Checking console access…
        </p>
      </AccessFrame>
    );
  if (session === "error")
    return (
      <AccessFrame title="Console unavailable" eyebrow="E-Z platform access">
        <Notice>{loadError}</Notice>
        <button className="ez-button" onClick={() => window.location.reload()}>
          Retry
        </button>
        <p>
          <a href="/console/login">Return to console login</a>
        </p>
      </AccessFrame>
    );
  return (
    <AccessFrame
      wide
      title="Company workspaces"
      eyebrow="E-Z operator console"
      actions={
        <>
          <span className="ez-console-name">{operator?.email}</span>
          <button
            className="ez-button"
            onClick={logout}
            disabled={Boolean(busy)}
          >
            Log out
          </button>
        </>
      }
    >
      <p className="ez-muted">
        Create isolated company accounts, manage access and set hard storage and
        AI allowances.
      </p>
      {actionError && <Notice>{actionError}</Notice>}
      {notice && <Notice success>{notice}</Notice>}
      {setup && (
        <section
          className="ez-card ez-once ez-section"
          aria-labelledby="owner-link-heading"
        >
          <h2 id="owner-link-heading" ref={setupHeading} tabIndex={-1}>
            Save the owner setup link for {setup.code}
          </h2>
          <p className="ez-muted">
            This one-use link is shown only now and expires after{" "}
            {setup.recovery ? "one hour" : "24 hours"}. Copy it and share it
            securely with the intended owner. It disappears when you dismiss,
            refresh or leave this page. No email has been sent.
          </p>
          <div className="ez-field">
            <label htmlFor="owner-setup-link">Owner setup link</label>
            <input
              id="owner-setup-link"
              type="url"
              readOnly
              autoComplete="off"
              spellCheck={false}
              value={setup.url}
              onFocus={(event) => event.target.select()}
            />
          </div>
          <div className="ez-actions ez-section">
            <button
              className="ez-button ez-button--primary"
              onClick={copySetup}
            >
              Copy setup link
            </button>
            <button className="ez-button" onClick={() => setSetup(null)}>
              I have saved the link
            </button>
          </div>
          {copied && (
            <p role="status" className="ez-help">
              Setup link copied.
            </p>
          )}
        </section>
      )}
      <section
        className="ez-card ez-section"
        aria-labelledby="create-company-heading"
      >
        <h2 id="create-company-heading">Create a company</h2>
        <p className="ez-help">
          Company codes are generated by the server and cannot be changed. The
          owner sets their own password using a one-time link.
        </p>
        <form
          className="ez-form"
          onSubmit={create}
          aria-busy={busy === "create"}
        >
          <div className="ez-grid-three">
            <div className="ez-field">
              <label htmlFor="company-name">Company name</label>
              <input
                id="company-name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={Boolean(busy)}
              />
            </div>
            <div className="ez-field">
              <label htmlFor="owner-name">Owner name</label>
              <input
                id="owner-name"
                required
                maxLength={100}
                autoComplete="off"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                disabled={Boolean(busy)}
              />
            </div>
            <div className="ez-field">
              <label htmlFor="owner-email">Owner email</label>
              <input
                id="owner-email"
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                disabled={Boolean(busy)}
              />
            </div>
          </div>
          <div className="ez-grid-two">
            <div className="ez-field">
              <label htmlFor="create-storage">Storage allowance (MiB)</label>
              <input
                id="create-storage"
                type="number"
                required
                min="0"
                step="1"
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                disabled={Boolean(busy)}
              />
              <small>100 MiB by default. Zero disables uploads.</small>
            </div>
            <div className="ez-field">
              <label htmlFor="create-seats">Account slots</label>
              <input
                id="create-seats"
                type="number"
                min="1"
                max="10000"
                step="1"
                required
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                disabled={Boolean(busy)}
              />
              <small>
                10 by default, including pending accounts. Not a billable-user
                meter.
              </small>
            </div>
            <div className="ez-field">
              <label htmlFor="create-ai">AI token allowance</label>
              <input
                id="create-ai"
                type="number"
                required
                min="0"
                step="1"
                value={ai}
                onChange={(e) => setAI(e.target.value)}
                disabled={Boolean(busy)}
              />
              <small>
                Zero by default. Cumulative, with no monthly reset. A limit
                alone does not configure or enable an AI provider.
              </small>
            </div>
          </div>
          <div className="ez-actions">
            <button
              type="submit"
              className="ez-button ez-button--primary"
              disabled={
                Boolean(busy) || loading || Boolean(loadError) || Boolean(setup)
              }
            >
              {busy === "create" ? "Creating company…" : "Create company"}
            </button>
            {setup && (
              <small className="ez-help">
                Save the current owner setup link before creating another
                company.
              </small>
            )}
          </div>
        </form>
      </section>
      <section className="ez-section" aria-labelledby="companies-heading">
        <div className="ez-section-header">
          <h2 id="companies-heading">Companies</h2>
          <button
            className="ez-button"
            onClick={refresh}
            disabled={loading || Boolean(busy)}
          >
            {loading ? "Refreshing…" : "Refresh companies"}
          </button>
        </div>
        {loading && (
          <p role="status" className="ez-help">
            Loading company data…
          </p>
        )}
        {loadError && <Notice>{loadError}</Notice>}
        {!loading && !loadError && tenants.length === 0 && (
          <div className="ez-card">
            <p>No companies yet. Create the first company above.</p>
          </div>
        )}
        {tenants.length > 0 && (
          <div
            className="ez-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Company workspaces table"
          >
            <table className="ez-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Status</th>
                  <th scope="col">Storage</th>
                  <th scope="col">Account slots</th>
                  <th scope="col">AI tokens</th>
                  <th scope="col">Controls</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <strong>{tenant.name}</strong>
                      <small>
                        <code>{tenant.code}</code>
                      </small>
                      <small>{tenant.ownerEmail}</small>
                    </td>
                    <td>
                      <span
                        className={`ez-status ez-status--${tenant.status.toLowerCase()}`}
                      >
                        {tenant.status}
                      </span>
                    </td>
                    <td>
                      {bytes(tenant.storageBytesUsed)}
                      <small>
                        of {bytes(tenant.storageLimitBytes)}
                        {Number(tenant.storageLimitBytes) === 0
                          ? " · disabled"
                          : ""}
                      </small>
                    </td>
                    <td>
                      {Number(tenant.seatLimit).toLocaleString()}
                      <small>Configured cap</small>
                    </td>
                    <td>
                      {Number(tenant.aiTokensUsed).toLocaleString()}
                      <small>
                        of {Number(tenant.aiTokenLimit).toLocaleString()}
                        {Number(tenant.aiTokenLimit) === 0 ? " · disabled" : ""}
                      </small>
                    </td>
                    <td>
                      <div className="ez-actions">
                        {(tenant.status === "ACTIVE" ||
                          tenant.status === "SUSPENDED") && (
                          <button
                            type="button"
                            className={`ez-button ${tenant.status === "ACTIVE" ? "ez-button--danger" : ""}`}
                            disabled={
                              Boolean(busy) || loading || Boolean(loadError)
                            }
                            onClick={() =>
                              update(tenant.id, {
                                status:
                                  tenant.status === "ACTIVE"
                                    ? "SUSPENDED"
                                    : "ACTIVE",
                              })
                            }
                          >
                            {busy === tenant.id
                              ? "Saving…"
                              : tenant.status === "ACTIVE"
                                ? "Suspend"
                                : "Resume"}
                          </button>
                        )}
                      </div>
                      <details className="ez-section">
                        <summary>Owner account recovery</summary>
                        <p className="ez-help">
                          Issuing a reset link does not change the password
                          until the owner uses it. Previous owner setup links
                          are invalidated. The new one-use link expires after
                          one hour and requires a fresh operator sign-in.
                        </p>
                        <button
                          type="button"
                          className="ez-button"
                          disabled={
                            Boolean(busy) ||
                            loading ||
                            Boolean(loadError) ||
                            Boolean(setup) ||
                            tenant.status !== "ACTIVE"
                          }
                          onClick={() => recoverOwner(tenant)}
                        >
                          Issue owner reset link
                        </button>
                      </details>
                      <TenantLimits
                        tenant={tenant}
                        pending={Boolean(busy) || loading || Boolean(loadError)}
                        onSave={update}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <OperatorPasswordForm
        disabled={Boolean(busy) || loading || Boolean(loadError)}
        onSignInRequired={requireSignIn}
      />
      <section className="ez-card ez-section" aria-labelledby="audit-heading">
        <h2 id="audit-heading">Recent audit activity</h2>
        {!loading && !loadError && audit.length === 0 && (
          <p className="ez-muted">No audit activity recorded yet.</p>
        )}
        <ul className="ez-audit-list">
          {audit.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.action.replace(/[._]/g, " ")}</strong>
                <small>
                  {tenants.find((tenant) => tenant.id === entry.tenantId)
                    ?.code || "Platform activity"}
                  {entry.operatorId ? " · operator action" : ""}
                </small>
              </div>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </section>
    </AccessFrame>
  );
}
