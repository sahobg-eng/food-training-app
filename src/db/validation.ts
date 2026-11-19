/** A user-facing validation problem (shown as-is in the UI). */
export class ValidationError extends Error {}

export const MAX_NAME_LENGTH = 60;

/** Trim and collapse inner whitespace; throws if empty or too long. */
export function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw new ValidationError('Enter a name.');
  if (name.length > MAX_NAME_LENGTH) throw new ValidationError(`Keep it under ${MAX_NAME_LENGTH} characters.`);
  return name;
}

/** Case- and accent-insensitive name equality. */
export const sameName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0;

/** Sort comparator for anything with a name: case-insensitive, numbers in natural order. */
export const byName = <T extends { name: string }>(a: T, b: T) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
