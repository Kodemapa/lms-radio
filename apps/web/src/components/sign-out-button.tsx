'use client';

import { useState } from 'react';
import { announceSessionEnded } from '@/lib/client-fetch';

export function SignOutButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      onClick={async () => {
        setPending(true);
        await fetch('/api/auth/logout', { method: 'POST' });
        announceSessionEnded();
        // Full reload: the signed-out page then uses the site's default theme.
        window.location.reload();
      }}
    >
      {label}
    </button>
  );
}
