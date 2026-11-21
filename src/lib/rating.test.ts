// ABOUTME: Tests for converting, validating, and formatting quarter-star ratings.
// ABOUTME: Ratings are stored as quarters 0–20, shown as 0–5 stars in 0.25 steps.

import { formatStars, isValidRatingQuarters, quartersFromStars, starFills, starsFromQuarters } from './rating.ts'

describe('starsFromQuarters', () => {
  it.each([
    [0, 0],
    [1, 0.25],
    [15, 3.75],
    [20, 5],
  ])('converts %i quarters to %d stars', (quarters, stars) => {
    expect(starsFromQuarters(quarters)).toBe(stars)
  })
})

describe('quartersFromStars', () => {
  it.each([
    [0, 0],
    [0.25, 1],
    [3.75, 15],
    [5, 20],
  ])('converts %d stars to %i quarters', (stars, quarters) => {
    expect(quartersFromStars(stars)).toBe(quarters)
  })

  it.each([-0.25, 5.25, 3.1, Number.NaN])('rejects %d stars', (stars) => {
    expect(() => quartersFromStars(stars)).toThrow(`Rating must be 0–5 stars in quarter steps, got ${stars}`)
  })
})

describe('isValidRatingQuarters', () => {
  it.each([0, 1, 19, 20])('accepts %i', (quarters) => {
    expect(isValidRatingQuarters(quarters)).toBe(true)
  })

  it.each([-1, 21, 2.5, Number.NaN])('rejects %d', (quarters) => {
    expect(isValidRatingQuarters(quarters)).toBe(false)
  })
})

describe('formatStars', () => {
  it.each([
    [0, '0'],
    [2, '0.5'],
    [13, '3.25'],
    [15, '3.75'],
    [20, '5'],
  ])('formats %i quarters as "%s"', (quarters, text) => {
    expect(formatStars(quarters)).toBe(text)
  })
})

describe('starFills', () => {
  it('fills each of the five stars by the fraction the rating covers', () => {
    expect(starFills(15)).toEqual([1, 1, 1, 0.75, 0])
  })

  it.each([
    [0, [0, 0, 0, 0, 0]],
    [1, [0.25, 0, 0, 0, 0]],
    [20, [1, 1, 1, 1, 1]],
  ])('fills %i quarters as %j', (quarters, fills) => {
    expect(starFills(quarters)).toEqual(fills)
  })
})
