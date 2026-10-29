import { useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { Notice } from "./AccessFrame";
import type { AuditRecord, PublicTenant } from "@/lib/access-api";

const PAGE_SIZE = 10;
const labels: Record<string, string> = {
  "tenant.created": "Company created",
  "tenant.provisioning": "Company provisioning started",
  "tenant.provisioning_failed": "Company provisioning failed",
  "tenant.updated": "Company settings updated",
  "tenant.suspended": "Company suspended",
  "tenant.resumed": "Company resumed",
  "tenant.owner_activated": "Company owner activated",
  "tenant.owner_setup_issued": "Owner recovery link issued",
  "tenant.owner_access_reset": "Owner access reset",
  "tenant.member_invited": "Company member invited",
  "tenant.member_activated": "Company member activated",
  "tenant.member_invitation_revoked": "Member invitation revoked",
  "operator.bootstrapped": "Operator account created",
  "operator.setup_provisioned": "Operator activation prepared",
  "operator.setup_reissued": "Operator activation reissued",
  "operator.setup_completed": "Operator account activated",
  "operator.password_changed": "Operator password changed",
  "operator.password_recovered": "Operator access recovered",
  "operator.mfa_enabled": "Authenticator protection enabled",
  "operator.mfa_disabled": "Authenticator protection disabled",
  "operator.mfa_verified": "Operator authenticator verified",
};
function actionLabel(action: string) {
  return (
    labels[action] ||
    action
      .replace(/[._-]+/g, " ")
      .replace(/^./, (character) => character.toUpperCase())
  );
}
function timestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString();
}

export function ConsoleActivity({
  audit,
  tenants,
  loading,
  error,
  onRefresh,
  disabled,
}: {
  audit: AuditRecord[];
  tenants: PublicTenant[];
  loading: boolean;
  error: string;
  onRefresh: () => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("all");
  const [page, setPage] = useState(0);
  const companyMap = useMemo(
    () => new Map(tenants.map((tenant) => [tenant.id, tenant])),
    [tenants],
  );
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return audit.filter((entry) => {
      if (company === "platform" && entry.tenantId) return false;
      if (
        company !== "all" &&
        company !== "platform" &&
        entry.tenantId !== company
      )
        return false;
      const tenant = entry.tenantId
        ? companyMap.get(entry.tenantId)
        : undefined;
      const context = tenant
        ? `${tenant.name} ${tenant.code}`
        : entry.tenantId
          ? "Company unavailable"
          : "Platform activity";
      return `${actionLabel(entry.action)} ${context}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [audit, search, company, companyMap]);
  const pageCount = Math.ceil(matches.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = matches.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const filtered = search.trim() !== "" || company !== "all";
  function clearFilters() {
    setSearch("");
    setCompany("all");
    setPage(0);
  }
  return (
    <section
      className="ez-console-panel"
      aria-labelledby="console-activity-heading"
    >
      <div className="ez-section-header">
        <div>
          <h2 id="console-activity-heading">Recent audit activity</h2>
          <p className="ez-help">
            Search the latest {audit.length.toLocaleString()} loaded events, up
            to 100. This is recent activity, not the complete history.
          </p>
        </div>
        <button
          type="button"
          className="ez-button"
          onClick={onRefresh}
          disabled={loading || disabled}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {loading ? "Refreshing activity…" : "Refresh activity"}
        </button>
      </div>
      <div className="ez-console-toolbar">
        <div className="ez-console-search ez-field">
          <label htmlFor="console-activity-search">Search activity</label>
          <div className="ez-console-search-input">
            <Search size={16} aria-hidden="true" />
            <input
              id="console-activity-search"
              type="search"
              placeholder="Search events or companies"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        <div className="ez-field">
          <label htmlFor="console-activity-company">Activity company</label>
          <select
            id="console-activity-company"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setPage(0);
            }}
          >
            <option value="all">All activity</option>
            <option value="platform">Platform only</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} · {tenant.code}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      {loading && (
        <p className="ez-help" role="status">
          Loading recent activity…
        </p>
      )}
      {!loading && !error && audit.length === 0 ? (
        <div className="ez-console-empty">
          <Activity size={24} aria-hidden="true" />
          <h3>No activity recorded yet</h3>
          <p>Company and operator changes will appear here.</p>
        </div>
      ) : matches.length === 0 && !loading && !error ? (
        <div className="ez-console-empty">
          <Search size={24} aria-hidden="true" />
          <h3>No matching activity</h3>
          <p>Try another search or company filter.</p>
          <button type="button" className="ez-button" onClick={clearFilters}>
            Clear activity filters
          </button>
        </div>
      ) : (
        <>
          {audit.length > 0 && (
            <p className="ez-help" aria-live="polite">
              {matches.length.toLocaleString()}{" "}
              {filtered ? "matching" : "loaded"}{" "}
              {matches.length === 1 ? "event" : "events"}
              {error ? " · Showing previously loaded activity" : ""}. Times
              shown in {timezone}.
            </p>
          )}
          <ul className="ez-console-activity">
            {visible.map((entry) => {
              const tenant = entry.tenantId
                ? companyMap.get(entry.tenantId)
                : undefined;
              return (
                <li key={entry.id} className="ez-console-activity-item">
                  <span className="ez-console-activity-icon">
                    <Activity size={17} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{actionLabel(entry.action)}</strong>
                    <p className="ez-help">
                      {tenant ? (
                        <>
                          {tenant.name} <code>{tenant.code}</code>
                        </>
                      ) : entry.tenantId ? (
                        "Company unavailable"
                      ) : (
                        "Platform activity"
                      )}
                    </p>
                  </div>
                  <time dateTime={entry.createdAt}>
                    {timestamp(entry.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
          {matches.length > PAGE_SIZE && (
            <nav className="ez-console-pagination" aria-label="Activity pages">
              <p className="ez-help">
                Page {currentPage + 1} of {pageCount}
              </p>
              <div className="ez-actions">
                <button
                  type="button"
                  className="ez-button"
                  aria-label="Previous activity page"
                  disabled={currentPage === 0}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  Previous
                </button>
                <button
                  type="button"
                  className="ez-button"
                  aria-label="Next activity page"
                  disabled={currentPage + 1 >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
