/** Shared public account states; authentication always goes through the server. */
import TenantLogin from "@/pages/TenantLogin";
import { AccessFrame, Notice } from "@/components/console/AccessFrame";

export function LoadingScreen() {
  return (
    <AccessFrame title="Opening your workspace" eyebrow="E-Z">
      <p className="ez-loading" role="status">
        Loading...
      </p>
    </AccessFrame>
  );
}
export function SignInScreen() {
  return <TenantLogin />;
}
export function SessionUnavailableScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <AccessFrame
      title="Your workspace could not be reached"
      eyebrow="Connection interrupted"
    >
      <Notice>
        We could not check your session. This may be a connection or service
        issue. Please retry before signing in again.
      </Notice>
      <button
        type="button"
        className="ez-button ez-button--primary"
        onClick={onRetry}
      >
        Retry connection
      </button>
      <p className="ez-section">
        <a href="/login">Return to company login</a>
      </p>
    </AccessFrame>
  );
}

export function SessionChangedScreen() {
  return (
    <AccessFrame title="Your sign-in changed" eyebrow="Workspace access">
      <Notice>
        Another tab changed the current sign-in. Reload to open that workspace.
      </Notice>
      <button
        type="button"
        className="ez-button ez-button--primary"
        onClick={() => window.location.reload()}
      >
        Reload workspace
      </button>
    </AccessFrame>
  );
}
