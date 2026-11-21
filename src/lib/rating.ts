// ABOUTME: Converts between stored quarter-star ratings and the 0–5 stars shown to the reader.
// ABOUTME: Matches the database rule: whole quarters from 0 to 20.

export const MAX_STARS = 5
const QUARTERS_PER_STAR = 4
const MAX_QUARTERS = MAX_STARS * QUARTERS_PER_STAR

export function isValidRatingQuarters(quarters: number): boolean {
  return Number.isInteger(quarters) && quarters >= 0 && quarters <= MAX_QUARTERS
}

export function starsFromQuarters(quarters: number): number {
  return quarters / QUARTERS_PER_STAR
}

export function quartersFromStars(stars: number): number {
  const quarters = stars * QUARTERS_PER_STAR
  if (!isValidRatingQuarters(quarters)) {
    throw new RangeError(`Rating must be 0–${MAX_STARS} stars in quarter steps, got ${stars}`)
  }
  return quarters
}

/** The rating in stars as text, without trailing zeros: 15 → "3.75", 8 → "2". */
export function formatStars(quarters: number): string {
  return String(starsFromQuarters(quarters))
}

/** How much of each of the five stars is filled, from 0 to 1, for drawing the rating. */
export function starFills(quarters: number): number[] {
  const stars = starsFromQuarters(quarters)
  return Array.from({ length: MAX_STARS }, (_, index) => Math.min(1, Math.max(0, stars - index)))
}
