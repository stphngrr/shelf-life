// ABOUTME: A book's cover image, falling back to a plain placeholder when there is none or it fails to load.
// ABOUTME: Decorative: the book's title is always shown alongside it.

import { useState } from 'react'

export function BookCover({ url, className = '' }: { url: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return <div data-testid="cover-placeholder" aria-hidden="true" className={`bg-gray-200 ${className}`} />
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-gray-100 object-cover ${className}`}
    />
  )
}
