'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from './input';

export function DebouncedSearchInput({
  id,
  name,
  placeholder,
  value: initialValue,
  label,
  autoSubmit = false,
}: {
  id: string;
  name: string;
  placeholder: string;
  value: string;
  label: string;
  autoSubmit?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoSubmit || !dirty) return;
    const timer = setTimeout(() => inputRef.current?.form?.requestSubmit(), 300);
    return () => clearTimeout(timer);
  }, [autoSubmit, dirty, value]);

  return (
    <Input
      ref={inputRef}
      id={id}
      name={name}
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(event) => {
        setDirty(true);
        setValue(event.target.value);
      }}
      aria-label={label}
    />
  );
}
