'use client';

import { type ComponentProps, useEffect, useRef } from 'react';

/**
 * GET form that re-submits when a choice changes (select, radio, checkbox).
 * Text fields don't auto-submit — React's onChange fires per keystroke — they submit on Enter.
 * Without JS it still works via a submit button.
 */
export function AutoSubmitForm(props: ComponentProps<'form'>) {
  const ref = useRef<HTMLFormElement>(null);

  // Back/forward cache restores the page as we left it, with "Any" fields disabled: re-enable them.
  useEffect(() => {
    const enable = () => {
      for (const element of Array.from(ref.current?.elements ?? [])) {
        if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) element.disabled = false;
      }
    };
    window.addEventListener('pageshow', enable);
    return () => window.removeEventListener('pageshow', enable);
  }, []);

  return (
    <form
      {...props}
      ref={ref}
      method="get"
      onChange={(event) => {
        const target = event.target;
        const isChoice =
          target instanceof HTMLSelectElement ||
          (target instanceof HTMLInputElement && (target.type === 'radio' || target.type === 'checkbox'));
        if (!isChoice) return;
        submitClean(event.currentTarget);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        submitClean(event.currentTarget);
      }}
    />
  );
}

/** Leaves empty values ("Any") out of the URL, then submits natively. */
function submitClean(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
      element.disabled = element.name !== '' && element.value === '';
    }
  }
  form.submit();
}
