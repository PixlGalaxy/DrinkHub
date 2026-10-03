import { useEffect, useState } from 'react';
import { clearRoom, loadRoom, loadToken, type StoredRoom } from '../session';

/**
 * The room this browser was last in for a game, but only if the server
 * confirms it still exists and we still hold a seat there. Stale entries
 * (room deleted, seat expired, left from another tab) are cleared, so the
 * lobby never offers a "reconnect" that bounces back.
 */
export function useStoredRoom(slug: string, sessionKey: string): StoredRoom | null {
  const [stored] = useState(() => loadRoom(sessionKey));
  const [confirmed, setConfirmed] = useState<StoredRoom | null>(null);

  useEffect(() => {
    if (!stored) return;
    const controller = new AbortController();
    const token = loadToken();
    fetch(`/api/${slug}/rooms/${encodeURIComponent(stored.roomCode)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((info: { exists?: boolean; seat?: boolean | null }) => {
        if (info.exists && info.seat !== false) {
          setConfirmed(stored);
        } else {
          clearRoom(sessionKey);
        }
      })
      .catch(() => {
        // Offline or server unreachable: offer it anyway; the room page
        // handles a missing room on its own.
        if (!controller.signal.aborted) setConfirmed(stored);
      });
    return () => controller.abort();
  }, [slug, sessionKey, stored]);

  return confirmed;
}
