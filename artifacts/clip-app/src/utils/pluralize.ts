/**
 * Russian pluralization helper.
 *
 * Picks the correct word form based on the number:
 *   1            → one   ("идея")
 *   2, 3, 4      → few   ("идеи")
 *   0, 5–20, etc → many  ("идей")
 *
 * Examples:
 *   pluralize(1,  "идея", "идеи", "идей") → "идея"
 *   pluralize(3,  "идея", "идеи", "идей") → "идеи"
 *   pluralize(47, "идея", "идеи", "идей") → "идей"
 */
export function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(n) % 100;
  const lastTwo = abs;
  const last = abs % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

/** Shortcut: returns "47 идей", "1 идея", etc. */
export function clipsCount(n: number): string {
  return `${n} ${pluralize(n, "идея", "идеи", "идей")}`;
}

/** Shortcut: returns "1 день", "3 дня", "7 дней", etc. */
export function daysCount(n: number): string {
  return `${n} ${pluralize(n, "день", "дня", "дней")}`;
}
