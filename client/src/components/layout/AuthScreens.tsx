/**
 * Full-screen states shown before the app shell: loading and sign-in.
 */

import { AlertCircle, CheckSquare, MessageSquare, TrendingUp } from 'lucide-react';
import AmbientBackground from './AmbientBackground';

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center">
      <AmbientBackground />
      <div className="glass flex flex-col items-center gap-4 rounded-3xl px-10 py-8">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#fff" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.63 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.54 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.61-.07-1.07-.15-1.53z" />
    </svg>
  );
}

const HIGHLIGHTS = [
  { icon: CheckSquare, text: 'Plan sprints and track tasks' },
  { icon: MessageSquare, text: 'Chat and post daily updates' },
  { icon: TrendingUp, text: 'Get AI weekly summaries' },
];

// Error codes the server's OAuth callback redirects back with (?error=...)
const SIGN_IN_ERRORS: Record<string, string> = {
  auth_failed:
    "Sign-in didn't work. Make sure you're using your company Google account and that you've been invited, then try again.",
  session_failed: "You signed in, but we couldn't start your session. Please try again.",
};

export function SignInScreen() {
  const errorCode = new URLSearchParams(window.location.search).get('error');
  const errorMessage = errorCode ? SIGN_IN_ERRORS[errorCode] : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <AmbientBackground />
      <div className="glass w-full max-w-md rounded-[2rem] px-8 py-10 text-center sm:px-10">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff7ad1] via-primary to-[#4d7bff] text-lg font-bold text-white shadow-xl shadow-primary/30">
          SB
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl">Welcome to ServiceBay PM</h1>
        <p className="mb-8 text-muted-foreground">Please sign in to continue</p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <a
          href="/api/auth/google"
          className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] hover:bg-primary/90 active:scale-100"
        >
          <GoogleIcon />
          Sign in with Google
        </a>

        <a
          href="/tour"
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Explore the product tour
        </a>

        <ul className="mt-8 space-y-2.5 text-left text-sm text-muted-foreground">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
