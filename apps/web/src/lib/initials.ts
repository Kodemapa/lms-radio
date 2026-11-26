/** "Dr Meera Iyer" → "MI"; "Dr Meera (Proctor)" → "MP" (letters and digits only). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((part) => part && !/^dr$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
