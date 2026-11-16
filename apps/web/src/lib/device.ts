const KEY = 'elms.deviceId';

/**
 * Stable per-browser id used for device binding. Kept in localStorage so it
 * survives sign-out; falls back to a per-tab id if storage is blocked.
 */
export function getDeviceId(): string {
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
