/**
 * Russian pluralization helper.
 *
 * Picks the correct word form based on the number:
 *   1            → one   ("цитата")
 *   2, 3, 4      → few   ("цитаты")
 *   0, 5–20, etc → many  ("цитат")
 *
 * Examples:
 *   pluralize(1,  "цитата", "цитаты", "цитат") → "цитата"
 *   pluralize(3,  "цитата", "цитаты", "цитат") → "цитаты"
 *   pluralize(47, "цитата", "цитаты", "цитат") → "цитат"
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

/** Shortcut: returns "47 цитат", "1 цитата", etc. */
export function clipsCount(n: number): string {
  return `${n} ${pluralize(n, "цитата", "цитаты", "цитат")}`;
}
