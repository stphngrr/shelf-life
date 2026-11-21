// ABOUTME: Draws a quarter-star rating as five partly filled stars.
// ABOUTME: Decorative: the rating is always also shown as text or a form value.

import { starFills } from '../lib/rating.ts'

export function StarRating({ quarters }: { quarters: number }) {
  const fills = starFills(quarters)
  return (
    <span data-testid="star-rating" data-fills={fills.join(',')} aria-hidden="true" className="inline-flex text-lg">
      {fills.map((fill, index) => (
        <span key={index} className="relative inline-block text-gray-300">
          ★
          <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: `${fill * 100}%` }}>
            ★
          </span>
        </span>
      ))}
    </span>
  )
}
