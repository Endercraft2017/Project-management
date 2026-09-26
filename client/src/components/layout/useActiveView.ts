/**
 * Active view, synced to the URL hash (#/tasks) so a refresh keeps the
 * current view and the browser back/forward buttons move between views.
 */

import { useCallback, useEffect, useState } from 'react';
import { isView, type View } from './navigation';

const DEFAULT_VIEW: View = 'dashboard';

function readHash(): View {
  const value = window.location.hash.replace(/^#\/?/, '');
  return isView(value) ? value : DEFAULT_VIEW;
}

export function useActiveView(isAllowed: (view: View) => boolean) {
  const [view, setViewState] = useState<View>(readHash);

  useEffect(() => {
    const onHashChange = () => setViewState(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setView = useCallback((next: View) => {
    setViewState(next);
    if (readHash() !== next || !window.location.hash) {
      window.location.hash = `/${next}`;
    }
  }, []);

  // Fall back if the hash points at a view this user can't open (e.g. team for members)
  const activeView = isAllowed(view) ? view : DEFAULT_VIEW;

  return [activeView, setView] as const;
}
