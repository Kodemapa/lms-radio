/** "Dr Meera Iyer" → "MI". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part && !/^dr\.?$/i.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
