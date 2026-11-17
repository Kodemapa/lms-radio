import { type ReactNode } from 'react';
import { Label } from '@obgyn/ui';

export function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span aria-hidden="true" className="ms-1 text-destructive">*</span>
    </Label>
  );
}
