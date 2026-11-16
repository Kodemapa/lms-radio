'use client';

import { type ComponentProps } from 'react';

/** GET form that re-submits whenever a field changes. Without JS it still works via a submit button. */
export function AutoSubmitForm(props: ComponentProps<'form'>) {
  return (
    <form
      {...props}
      method="get"
      onChange={(event) => {
        const form = event.currentTarget;
        // Leave empty values ("Any") out of the URL.
        for (const element of Array.from(form.elements)) {
          if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
            element.disabled = element.name !== '' && element.value === '';
          }
        }
        form.requestSubmit();
      }}
    />
  );
}
