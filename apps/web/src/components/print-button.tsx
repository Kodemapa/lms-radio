'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover"
    >
      <Printer aria-hidden className="size-4" />
      {label}
    </button>
  );
}
