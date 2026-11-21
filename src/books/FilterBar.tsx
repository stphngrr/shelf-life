// ABOUTME: Filter controls for browsing: search, year, tag, and status chips, result count, and clear.
// ABOUTME: Controlled by its parent, which keeps the filters in the URL.

import type { ReactNode } from 'react'
import { DEFAULT_FILTERS, STATUS_FILTERS, isStatusIncluded, toggleStatusFilter, type Filters } from '../lib/filters.ts'
import { STATUS_LABELS } from '../lib/statusLabels.ts'
import { filtersToHash } from '../lib/urlState.ts'
import type { FilterUpdateOptions } from './useFilters.ts'

interface FilterBarProps {
  filters: Filters
  years: number[]
  tags: string[]
  resultCount: number
  onChange: (next: Filters, options?: FilterUpdateOptions) => void
  /** Extra controls shown beside the result count, such as the view toggle. */
  actions?: ReactNode
}

function toggled<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

function ToggleChip({
  label,
  pressed,
  disabled = false,
  onClick,
}: {
  label: string
  pressed: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap disabled:cursor-not-allowed ${
        pressed ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  )
}

function ChipGroup({ name, children }: { name: string; children: ReactNode }) {
  return (
    // On phones each group is one row that scrolls sideways, so the books stay near the top.
    <div
      role="group"
      aria-label={name}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0"
    >
      {children}
    </div>
  )
}

function describeCount(count: number): string {
  if (count === 0) return 'No books match'
  return count === 1 ? '1 book' : `${count} books`
}

export function FilterBar({ filters, years, tags, resultCount, onChange, actions }: FilterBarProps) {
  const isDefault = filtersToHash(filters) === filtersToHash(DEFAULT_FILTERS)
  const searching = filters.search.trim() !== ''
  const includedStatusCount = STATUS_FILTERS.filter((s) => isStatusIncluded(filters.statuses, s)).length

  return (
    <section aria-label="Filters" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <input
          type="search"
          aria-label="Search titles and authors"
          placeholder="Search titles and authors"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value }, { replace: true })}
          className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none"
        />
        {searching && filters.years.length > 0 && <p className="text-sm text-gray-600">Searching all years</p>}
      </div>

      <ChipGroup name="Status">
        {STATUS_FILTERS.map((status) => {
          const pressed = isStatusIncluded(filters.statuses, status)
          return (
            <ToggleChip
              key={status}
              label={STATUS_LABELS[status]}
              pressed={pressed}
              disabled={pressed && includedStatusCount === 1}
              onClick={() => onChange({ ...filters, statuses: toggleStatusFilter(filters.statuses, status) })}
            />
          )
        })}
      </ChipGroup>

      <ChipGroup name="Years">
        {years.map((year) => (
          <ToggleChip
            key={year}
            label={String(year)}
            pressed={filters.years.includes(year)}
            onClick={() => onChange({ ...filters, years: toggled(filters.years, year) })}
          />
        ))}
      </ChipGroup>

      <ChipGroup name="Tags">
        {tags.map((tag) => (
          <ToggleChip
            key={tag}
            label={tag}
            pressed={filters.tags.includes(tag)}
            onClick={() => onChange({ ...filters, tags: toggled(filters.tags, tag) })}
          />
        ))}
      </ChipGroup>

      <div className="flex items-center justify-between gap-4">
        <p role="status" className="text-sm font-medium text-gray-700">
          {describeCount(resultCount)}
        </p>
        <span className="ml-auto">{actions}</span>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="text-sm text-gray-700 underline disabled:text-gray-400 disabled:no-underline"
        >
          Clear filters
        </button>
      </div>
    </section>
  )
}
