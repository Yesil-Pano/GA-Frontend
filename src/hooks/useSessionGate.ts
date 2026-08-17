// src/hooks/useSessionGate.ts

import { useEffect, useState } from 'react';
import {
  getAccessToken,
  hasStoredSession,
  shouldRefreshAccessToken,
  tryRefreshSession,
} from '../utils/sessionTokens';

export function useSessionGate() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!hasStoredSession()) {
          if (!cancelled) {
            setAuthed(false);
            setReady(true);
          }
          return;
        }

        let token = getAccessToken();
        if (!token) {
          const refreshed = await tryRefreshSession();
          token = getAccessToken();
          if (!cancelled) setAuthed(refreshed && !!token);
        } else {
          if (shouldRefreshAccessToken(token, 60)) {
            await tryRefreshSession();
          }
          if (!cancelled) setAuthed(!!getAccessToken());
        }
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, authed };
}
