import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";
import { OperatorPasswordForm } from "@/components/console/OperatorPasswordForm";
import { OperatorMfaForm } from "@/components/console/OperatorMfaForm";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import {
  ConsoleShell,
  type ConsoleSection,
} from "@/components/console/ConsoleShell";
import { ConsoleDialog } from "@/components/console/ConsoleDialog";
import { ConsoleActivity } from "@/components/console/ConsoleActivity";
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
  onDirtyChange,
}: {
  tenant: PublicTenant;
  pending: boolean;
  onDirtyChange: (dirty: boolean) => void;
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
  useEffect(() => {
    onDirtyChange(
      name !== tenant.name ||
        storage !== String(tenant.storageLimitBytes / MIB) ||
        ai !== String(tenant.aiTokenLimit) ||
        seats !== String(tenant.seatLimit),
    );
  }, [
    name,
    storage,
    ai,
    seats,
    tenant.name,
    tenant.storageLimitBytes,
    tenant.aiTokenLimit,
    tenant.seatLimit,
    onDirtyChange,
  ]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter a company display name.");
      return;
    }
    try {
      const value = nonnegative(storage) * MIB;
      const seatLimit = nonnegative(seats);
      if (!Number.isSafeInteger(value) || seatLimit < 1 || seatLimit > 10000)
        throw new Error();
      await onSave(tenant.id, {
        name: name.trim(),
        storageLimitBytes: value,
        aiTokenLimit: nonnegative(ai),
        seatLimit,
      });
    } catch {
      setError(
        "Use whole non-negative allowances and between 1 and 10,000 account slots.",
      );
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

type Confirmation = {
  tenantId: string;
  action: "suspend" | "resume" | "recover";
};
const PAGE_SIZE = 10;
function isAuthFailure(error: unknown) {
  return (
    error instanceof AccessError &&
    (error.status === 401 || error.status === 403)
  );
}
function Usage({
  used,
  limit,
  tokens = false,
}: {
  used: number;
  limit: number;
  tokens?: boolean;
}) {
  const format = tokens
    ? (value: number) => Number(value).toLocaleString()
    : bytes;
  const percentage =
    limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  return (
    <div>
      <span>
        {format(used)} <span className="ez-muted">/ {format(limit)}</span>
      </span>
      <small>
        {limit === 0
          ? "No allowance"
          : tokens
            ? "Cumulative allowance"
            : "Storage used"}
      </small>
      {limit > 0 && (
        <span
          className="ez-console-meter"
          data-warning={percentage >= 80}
          aria-hidden="true"
        >
          <span style={{ width: `${percentage}%` }} />
        </span>
      )}
    </div>
  );
}
export default function ConsoleTenants() {
  const [session, setSession] = useState<
    "loading" | "ready" | "anonymous" | "error"
  >("loading");
  const [operator, setOperator] = useState<OperatorUser | null>(null);
  const [signInNotice, setSignInNotice] = useState("");
  const [section, setSection] = useState<ConsoleSection>("workspaces");
  const [tenants, setTenants] = useState<PublicTenant[]>([]);
  const [audit, setAudit] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDirty, setSelectedDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
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
  const mounted = useRef(true);
  const mutation = useRef(false);
  const dataEpoch = useRef(0);
  const selected = tenants.find((tenant) => tenant.id === selectedId);
  const confirmingTenant = tenants.find(
    (tenant) => tenant.id === confirmation?.tenantId,
  );
  const mutationsDisabled = Boolean(busy) || loading || Boolean(loadError);
  const requireSignIn = useCallback((message: string) => {
    dataEpoch.current += 1;
    setLoading(false);
    setAuditLoading(false);
    setTenants([]);
    setAudit([]);
    setSetup(null);
    setOperator(null);
    setCreateOpen(false);
    setSelectedId(null);
    setSelectedDirty(false);
    setDiscardOpen(false);
    setConfirmation(null);
    setName("");
    setOwnerName("");
    setOwnerEmail("");
    setActionError("");
    setNotice("");
    setSignInNotice(message);
    setSession("anonymous");
  }, []);
  const failure = useCallback(
    (error: unknown) => {
      if (isAuthFailure(error))
        requireSignIn(
          error instanceof AccessError &&
            error.code === "OPERATOR_REAUTH_REQUIRED"
            ? "Sign in again before issuing an owner recovery link. No reset link has been issued."
            : "Your operator session has ended. Sign in again to continue.",
        );
      else setActionError(accessErrorMessage(error));
    },
    [requireSignIn],
  );
  const refresh = useCallback(async () => {
    const epoch = dataEpoch.current;
    setLoading(true);
    setAuditLoading(true);
    const results = await Promise.allSettled([
      accessApi.tenants(),
      accessApi.audit(),
    ]);
    if (!mounted.current || epoch !== dataEpoch.current) return;
    const authError = results.find(
      (result) => result.status === "rejected" && isAuthFailure(result.reason),
    );
    if (authError?.status === "rejected") {
      failure(authError.reason);
      setLoading(false);
      setAuditLoading(false);
      return;
    }
    if (results[0].status === "fulfilled") {
      setTenants(results[0].value);
      setLoadError("");
    } else
      setLoadError(
        "Company data could not be loaded. Previously loaded companies may be out of date. Refresh before making changes.",
      );
    if (results[1].status === "fulfilled") {
      setAudit(results[1].value);
      setAuditError("");
    } else
      setAuditError(
        "Recent activity could not be loaded. You can still manage companies and your account.",
      );
    setLoading(false);
    setAuditLoading(false);
  }, [failure]);
  useEffect(() => {
    mounted.current = true;
    let live = true;
    accessApi
      .operatorMe()
      .then(async (result) => {
        if (!live) return;
        if (!result.user?.id) throw new AccessError(401);
        setOperator(result.user);
        setSession("ready");
        await refresh();
      })
      .catch((error) => {
        if (!live) return;
        if (isAuthFailure(error)) requireSignIn("");
        else {
          setSession("error");
          setLoadError("The console could not be loaded. Please retry.");
        }
      });
    return () => {
      live = false;
      mounted.current = false;
    };
  }, [refresh, requireSignIn]);
  useEffect(() => {
    if (setup) setupHeading.current?.focus();
  }, [setup]);
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tenants
      .filter(
        (tenant) =>
          (status === "all" || tenant.status === status) &&
          `${tenant.name} ${tenant.code} ${tenant.ownerName} ${tenant.ownerEmail}`
            .toLocaleLowerCase()
            .includes(query),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "storage"
            ? b.storageBytesUsed - a.storageBytesUsed
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [tenants, search, status, sort]);
  const pageCount = Math.ceil(matches.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = matches.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const active = tenants.filter((tenant) => tenant.status === "ACTIVE").length;
  function begin(key: string) {
    if (mutation.current) return false;
    mutation.current = true;
    setBusy(key);
    setActionError("");
    setNotice("");
    return true;
  }
  function end() {
    mutation.current = false;
    setBusy(null);
  }
  function setupLink(
    result: { data: PublicTenant; setupUrl: string },
    recovery = false,
  ) {
    try {
      const url = new URL(result.setupUrl, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        url.pathname !== "/activate" ||
        url.searchParams.get("tenantCode") !== result.data.code ||
        !url.searchParams.get("token")
      )
        throw new Error();
      setSetup({ code: result.data.code, url: url.href, recovery });
      setCopied(false);
    } catch {
      setNotice(
        recovery
          ? "The recovery request completed, but the link could not be shown. Sign in again before requesting a replacement."
          : "Company created, but the setup link was unavailable. Do not create a duplicate company. Use owner recovery after checking the company details.",
      );
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (mutationsDisabled || setup || mutation.current) return;
    if (!name.trim() || !ownerName.trim()) {
      setActionError("Enter the company name and owner name.");
      return;
    }
    let input: TenantInput;
    try {
      const limit = nonnegative(storage) * MIB,
        seatLimit = nonnegative(seats);
      if (!Number.isSafeInteger(limit) || seatLimit < 1 || seatLimit > 10000)
        throw new Error();
      input = {
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        storageLimitBytes: limit,
        aiTokenLimit: nonnegative(ai),
        seatLimit,
      };
    } catch {
      setActionError(
        "Use whole non-negative allowances and between 1 and 10,000 account slots.",
      );
      return;
    }
    if (!begin("create")) return;
    try {
      const result = await accessApi.createTenant(input);
      setTenants((previous) => [
        result.data,
        ...previous.filter((tenant) => tenant.id !== result.data.id),
      ]);
      setCreateOpen(false);
      setupLink(result);
      setName("");
      setOwnerName("");
      setOwnerEmail("");
      setStorage("100");
      setAI("0");
      setSeats("10");
      setSearch("");
      setStatus("all");
      setPage(0);
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      end();
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
    if (mutationsDisabled || !begin(id)) return;
    try {
      const changed = await accessApi.updateTenant(id, patch);
      setTenants((previous) =>
        previous.map((tenant) => (tenant.id === id ? changed : tenant)),
      );
      setConfirmation(null);
      setNotice("Company settings saved.");
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      end();
    }
  }
  async function recoverOwner(tenant: PublicTenant) {
    if (mutationsDisabled || setup || !begin(tenant.id)) return;
    try {
      const result = await accessApi.ownerSetup(tenant.id);
      setConfirmation(null);
      setSelectedId(null);
      setupLink(result, true);
      await refresh();
    } catch (error) {
      failure(error);
    } finally {
      end();
    }
  }
  async function logout() {
    if (!begin("logout")) return;
    try {
      await accessApi.operatorLogout();
      requireSignIn("");
      navigateTo("/console/login");
    } catch (error) {
      failure(error);
    } finally {
      end();
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
  function ask(tenant: PublicTenant, action: Confirmation["action"]) {
    setActionError("");
    setConfirmation({ tenantId: tenant.id, action });
  }
  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPage(0);
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
    <ConsoleShell
      section={section}
      onSectionChange={setSection}
      operator={operator}
      onLogout={logout}
      busy={Boolean(busy)}
    >
      <header className="ez-console-page-heading">
        <div>
          <h1>
            {section === "workspaces"
              ? "Company workspaces"
              : section === "activity"
                ? "Activity"
                : "Account security"}
          </h1>
          <p>
            {section === "workspaces"
              ? "Manage company access, owners and allowances from one place."
              : section === "activity"
                ? "Follow recent changes across your companies and operator account."
                : "Protect your operator account and manage how you sign in."}
          </p>
        </div>
        {section === "workspaces" && (
          <button
            type="button"
            className="ez-button ez-button--primary"
            onClick={() => {
              setActionError("");
              setCreateOpen(true);
            }}
            disabled={mutationsDisabled || Boolean(setup)}
          >
            <Plus size={17} aria-hidden="true" />
            Create company
          </button>
        )}
      </header>
      {actionError && !createOpen && !selected && !confirmation && (
        <Notice>{actionError}</Notice>
      )}
      {notice && !selected && !confirmation && (
        <Notice success>{notice}</Notice>
      )}
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
              {copied ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Copy size={16} aria-hidden="true" />
              )}
              {copied ? "Setup link copied" : "Copy setup link"}
            </button>
            <button className="ez-button" onClick={() => setSetup(null)}>
              I have saved the link
            </button>
          </div>
        </section>
      )}
      {section === "workspaces" && (
        <>
          <div className="ez-console-stats" aria-label="Loaded company summary">
            <div className="ez-console-stat">
              <span>Total companies</span>
              <strong>
                {(loading || loadError) && tenants.length === 0
                  ? "—"
                  : tenants.length.toLocaleString()}
              </strong>
              <small>Loaded companies</small>
            </div>
            <div className="ez-console-stat">
              <span>Active</span>
              <strong>
                {(loading || loadError) && tenants.length === 0
                  ? "—"
                  : active.toLocaleString()}
              </strong>
              <small>Workspace access enabled</small>
            </div>
            <div className="ez-console-stat">
              <span>Needs attention</span>
              <strong>
                {(loading || loadError) && tenants.length === 0
                  ? "—"
                  : (tenants.length - active).toLocaleString()}
              </strong>
              <small>Suspended, provisioning or failed</small>
            </div>
          </div>
          <section
            className="ez-console-panel"
            aria-labelledby="companies-heading"
          >
            <div className="ez-section-header">
              <div>
                <h2 id="companies-heading">Companies</h2>
                <p className="ez-help">
                  Select a company to manage its access and limits.
                </p>
              </div>
              <button
                className="ez-button"
                onClick={refresh}
                disabled={loading || Boolean(busy)}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {loading ? "Refreshing…" : "Refresh companies"}
              </button>
            </div>
            <div className="ez-console-toolbar">
              <div className="ez-field ez-console-search">
                <label htmlFor="company-search">Search companies</label>
                <div className="ez-console-search-input">
                  <Search size={17} aria-hidden="true" />
                  <input
                    id="company-search"
                    type="search"
                    value={search}
                    placeholder="Company, code or owner"
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>
              <div className="ez-console-filters">
                <div className="ez-field">
                  <label htmlFor="company-status">Company status</label>
                  <select
                    id="company-status"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="all">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="PROVISIONING">Provisioning</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>
                <div className="ez-field">
                  <label htmlFor="company-sort">Sort companies</label>
                  <select
                    id="company-sort"
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value);
                      setPage(0);
                    }}
                  >
                    <option value="newest">Newest first</option>
                    <option value="name">Company name</option>
                    <option value="storage">Most storage used</option>
                  </select>
                </div>
              </div>
            </div>
            {loading && (
              <p role="status" className="ez-help">
                Loading company data…
              </p>
            )}
            {loadError && <Notice>{loadError}</Notice>}
            {!loading && !loadError && tenants.length === 0 ? (
              <div className="ez-console-empty">
                <Building2 size={28} aria-hidden="true" />
                <h2>No companies yet</h2>
                <p>
                  Create your first company workspace and share its one-time
                  owner setup link.
                </p>
              </div>
            ) : !loading && !loadError && matches.length === 0 ? (
              <div className="ez-console-empty">
                <Search size={28} aria-hidden="true" />
                <h2>No companies match</h2>
                <p>Try a different name, owner, company code or status.</p>
                <button className="ez-button" onClick={clearFilters}>
                  Clear company filters
                </button>
              </div>
            ) : (
              tenants.length > 0 && (
                <div
                  className="ez-table-wrap"
                  role="region"
                  aria-label="Company workspaces table"
                  tabIndex={0}
                >
                  <table className="ez-console-table">
                    <thead>
                      <tr>
                        <th scope="col">Company</th>
                        <th scope="col">Owner</th>
                        <th scope="col">Status</th>
                        <th scope="col">Storage</th>
                        <th scope="col">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((tenant) => (
                        <tr key={tenant.id}>
                          <td>
                            <button
                              className="ez-console-company-button"
                              onClick={() => {
                                setActionError("");
                                setSelectedId(tenant.id);
                              }}
                            >
                              <span
                                className="ez-console-company-avatar"
                                aria-hidden="true"
                              >
                                {tenant.name.slice(0, 2).toUpperCase()}
                              </span>
                              <span>
                                <strong>{tenant.name}</strong>
                                <small>
                                  <code>{tenant.code}</code>
                                </small>
                              </span>
                            </button>
                          </td>
                          <td data-label="Owner">
                            <div>
                              {tenant.ownerName}
                              <small>{tenant.ownerEmail}</small>
                            </div>
                          </td>
                          <td data-label="Status">
                            <span
                              className={`ez-status ez-status--${tenant.status.toLowerCase()}`}
                            >
                              {tenant.status.toLowerCase()}
                            </span>
                          </td>
                          <td data-label="Storage">
                            <Usage
                              used={tenant.storageBytesUsed}
                              limit={tenant.storageLimitBytes}
                            />
                          </td>
                          <td data-label="Actions">
                            <button
                              className="ez-button"
                              aria-label={`Manage ${tenant.name}`}
                              onClick={() => {
                                setActionError("");
                                setSelectedId(tenant.id);
                              }}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
            {tenants.length > 0 && (
              <nav className="ez-console-pagination" aria-label="Company pages">
                <span aria-live="polite">
                  {matches.length
                    ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, matches.length)} of ${matches.length.toLocaleString()} companies`
                    : "0 matching companies"}
                  {loadError ? " · Previously loaded data" : ""}
                </span>
                <div>
                  <button
                    className="ez-button"
                    aria-label="Previous company page"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={15} aria-hidden="true" />
                    Previous
                  </button>
                  <button
                    className="ez-button"
                    aria-label="Next company page"
                    disabled={currentPage + 1 >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                </div>
              </nav>
            )}
          </section>
          {tenants.length >= 500 && (
            <p className="ez-help">
              Showing the first 500 loaded companies. Search and summaries apply
              to these loaded companies only.
            </p>
          )}
        </>
      )}
      <div hidden={section !== "activity"}>
        <ConsoleActivity
          audit={audit}
          tenants={tenants}
          loading={auditLoading}
          error={auditError}
          onRefresh={refresh}
          disabled={Boolean(busy)}
        />
      </div>
      <div hidden={section !== "security"}>
        <div className="ez-card" style={{ marginBottom: 24 }}>
          <p className="ez-eyebrow">Your operator account</p>
          <strong>{operator?.name}</strong>
          <p className="ez-muted">{operator?.email}</p>
          <p className="ez-help">
            These settings protect platform access. Company owners manage their
            own workspace passwords.
          </p>
        </div>
        <div className="ez-console-security-grid">
          <OperatorPasswordForm
            disabled={Boolean(busy)}
            onSignInRequired={requireSignIn}
            onPendingChange={(pending) => setBusy(pending ? "security" : null)}
          />
          <OperatorMfaForm
            disabled={Boolean(busy)}
            onSignInRequired={requireSignIn}
            onPendingChange={(pending) => setBusy(pending ? "security" : null)}
          />
        </div>
      </div>
      <ConsoleDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setActionError("");
        }}
        title="Create a company"
        description="Create an isolated workspace. Its owner chooses their password using a one-time setup link."
        wide
        busy={Boolean(busy)}
      >
        {actionError && <Notice>{actionError}</Notice>}
        <form
          className="ez-form"
          onSubmit={create}
          aria-busy={busy === "create"}
        >
          <div className="ez-console-step-label">
            <span>1</span>Company and owner
          </div>
          <div className="ez-field">
            <label htmlFor="company-name">Company name</label>
            <input
              id="company-name"
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={Boolean(busy)}
            />
          </div>
          <div className="ez-grid-two">
            <div className="ez-field">
              <label htmlFor="owner-name">Owner name</label>
              <input
                id="owner-name"
                required
                maxLength={100}
                autoComplete="off"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
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
                onChange={(event) => setOwnerEmail(event.target.value)}
                disabled={Boolean(busy)}
              />
            </div>
          </div>
          <details>
            <summary>Customize allowances</summary>
            <p className="ez-help">
              Defaults: 10 account slots, 100 MiB storage and no AI tokens.
              Account slots include active and pending accounts.
            </p>
            <div className="ez-grid-three">
              <div className="ez-field">
                <label htmlFor="create-storage">Storage allowance (MiB)</label>
                <input
                  id="create-storage"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={storage}
                  onChange={(event) => setStorage(event.target.value)}
                  disabled={Boolean(busy)}
                />
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
                  onChange={(event) => setSeats(event.target.value)}
                  disabled={Boolean(busy)}
                />
              </div>
              <div className="ez-field">
                <label htmlFor="create-ai">AI token allowance</label>
                <input
                  id="create-ai"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={ai}
                  onChange={(event) => setAI(event.target.value)}
                  disabled={Boolean(busy)}
                />
              </div>
            </div>
            <p className="ez-help">
              Zero storage allowance disables new uploads. AI allowance is
              cumulative with no monthly reset; a limit does not enable an AI
              provider.
            </p>
          </details>
          <p className="ez-help">
            Company codes are generated automatically and cannot be changed. No
            email is sent automatically.
          </p>
          <div className="ez-console-form-footer">
            <button
              type="button"
              className="ez-button"
              onClick={() => setCreateOpen(false)}
              disabled={Boolean(busy)}
            >
              Cancel
            </button>
            <button
              className="ez-button ez-button--primary"
              type="submit"
              disabled={mutationsDisabled || Boolean(setup)}
            >
              {busy === "create" ? "Creating company…" : "Create company"}
            </button>
          </div>
        </form>
      </ConsoleDialog>
      <ConsoleDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            if (selectedDirty) {
              setDiscardOpen(true);
              return;
            }
            setSelectedId(null);
            setActionError("");
          }
        }}
        title={selected?.name || "Company details"}
        description="Workspace identity, usage and access controls."
        wide
        busy={Boolean(busy)}
      >
        {selected && (
          <>
            {notice && <Notice success>{notice}</Notice>}
            {actionError && <Notice>{actionError}</Notice>}
            <div className="ez-console-detail-header">
              <span className="ez-console-company-avatar" aria-hidden="true">
                {selected.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <code>{selected.code}</code>
                <p className="ez-help">Permanent company code</p>
              </div>
              <span
                className={`ez-status ez-status--${selected.status.toLowerCase()}`}
              >
                {selected.status.toLowerCase()}
              </span>
            </div>
            <dl className="ez-console-detail-grid">
              <div>
                <dt>Company owner</dt>
                <dd>{selected.ownerName}</dd>
              </div>
              <div>
                <dt>Owner email</dt>
                <dd>{selected.ownerEmail}</dd>
              </div>
              <div>
                <dt>Storage usage</dt>
                <dd>
                  <Usage
                    used={selected.storageBytesUsed}
                    limit={selected.storageLimitBytes}
                  />
                </dd>
              </div>
              <div>
                <dt>AI token usage</dt>
                <dd>
                  <Usage
                    used={selected.aiTokensUsed}
                    limit={selected.aiTokenLimit}
                    tokens
                  />
                </dd>
              </div>
              <div>
                <dt>Account slot limit</dt>
                <dd>
                  {selected.seatLimit.toLocaleString()}
                  <p className="ez-help">Configured cap, not live membership</p>
                </dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{new Date(selected.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
            <section className="ez-console-detail-section">
              <h3>Company settings</h3>
              <TenantLimits
                tenant={selected}
                pending={mutationsDisabled}
                onSave={update}
                onDirtyChange={setSelectedDirty}
              />
            </section>
            <section className="ez-console-detail-section">
              <h3>Owner account recovery</h3>
              <p>
                Issue a one-use password reset link for the owner. Previous
                owner setup links are invalidated. The replacement expires after
                one hour and requires a fresh operator sign-in.
              </p>
              <button
                className="ez-button"
                onClick={() => ask(selected, "recover")}
                disabled={
                  mutationsDisabled ||
                  Boolean(setup) ||
                  selected.status !== "ACTIVE" ||
                  selectedDirty
                }
              >
                Issue owner reset link
              </button>
              {selectedDirty && (
                <p className="ez-help">
                  Save or discard your limit edits before issuing an owner reset
                  link.
                </p>
              )}
              {setup && (
                <p className="ez-help">
                  Save the current setup link before issuing another.
                </p>
              )}
            </section>
            {(selected.status === "ACTIVE" ||
              selected.status === "SUSPENDED") && (
              <section className="ez-console-danger-zone">
                <h3>
                  {selected.status === "ACTIVE"
                    ? "Suspend company access"
                    : "Resume company access"}
                </h3>
                <p>
                  {selected.status === "ACTIVE"
                    ? "Suspension blocks workspace access for everyone in this company. Stored data is retained."
                    : "Resume access for this company. Existing account passwords and limits stay in place."}
                </p>
                <button
                  className={`ez-button ${selected.status === "ACTIVE" ? "ez-button--danger" : ""}`}
                  onClick={() =>
                    ask(
                      selected,
                      selected.status === "ACTIVE" ? "suspend" : "resume",
                    )
                  }
                  disabled={mutationsDisabled}
                >
                  {selected.status === "ACTIVE" ? "Suspend" : "Resume"}
                </button>
              </section>
            )}
            {(selected.status === "PROVISIONING" ||
              selected.status === "FAILED") && (
              <div className="ez-console-confirm">
                <TriangleAlert size={18} aria-hidden="true" />
                <p>
                  This company is {selected.status.toLowerCase()}. Review recent
                  activity before attempting owner access. No retry or deletion
                  is performed here.
                </p>
              </div>
            )}
          </>
        )}
      </ConsoleDialog>
      <ConsoleDialog
        layer={1}
        open={Boolean(confirmation && confirmingTenant)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmation(null);
            setActionError("");
          }
        }}
        title={
          confirmation?.action === "recover"
            ? "Issue an owner reset link?"
            : confirmation?.action === "suspend"
              ? "Suspend this company?"
              : "Resume this company?"
        }
        description={
          confirmingTenant
            ? `${confirmingTenant.name} · ${confirmingTenant.code}`
            : undefined
        }
        busy={Boolean(busy)}
      >
        {actionError && <Notice>{actionError}</Notice>}
        <div className="ez-console-confirm">
          <TriangleAlert size={20} aria-hidden="true" />
          <p>
            {confirmation?.action === "recover"
              ? "Previous owner setup links will stop working. The owner password only changes when the new one-use link is redeemed. Share it securely; no email will be sent."
              : confirmation?.action === "suspend"
                ? "Everyone in this company will lose workspace access. Company data will be retained. You can resume access later."
                : "Company members will be able to access their workspace again using their existing credentials."}
          </p>
        </div>
        <div className="ez-console-form-footer">
          <button
            className="ez-button"
            aria-label="Cancel confirmation"
            disabled={Boolean(busy)}
            onClick={() => {
              setConfirmation(null);
              setActionError("");
            }}
          >
            Cancel
          </button>
          <button
            className={`ez-button ${confirmation?.action === "suspend" ? "ez-button--danger" : "ez-button--primary"}`}
            disabled={
              mutationsDisabled ||
              (confirmation?.action === "recover" && Boolean(setup))
            }
            onClick={() => {
              if (!confirmingTenant || !confirmation) return;
              if (confirmation.action === "recover")
                void recoverOwner(confirmingTenant);
              else
                void update(confirmingTenant.id, {
                  status:
                    confirmation.action === "suspend" ? "SUSPENDED" : "ACTIVE",
                });
            }}
          >
            {busy
              ? "Saving…"
              : confirmation?.action === "recover"
                ? "Confirm owner reset"
                : confirmation?.action === "suspend"
                  ? "Confirm suspension"
                  : "Confirm resume"}
          </button>
        </div>
      </ConsoleDialog>
      <ConsoleDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description="Your company settings have not been saved."
        layer={1}
        busy={Boolean(busy)}
      >
        <p>
          Closing this company will discard your edits. Its saved settings will
          stay as they are.
        </p>
        <div className="ez-console-form-footer">
          <button className="ez-button" onClick={() => setDiscardOpen(false)}>
            Keep editing
          </button>
          <button
            className="ez-button ez-button--danger"
            onClick={() => {
              setDiscardOpen(false);
              setSelectedDirty(false);
              setSelectedId(null);
              setActionError("");
            }}
          >
            Discard changes
          </button>
        </div>
      </ConsoleDialog>
    </ConsoleShell>
  );
}
