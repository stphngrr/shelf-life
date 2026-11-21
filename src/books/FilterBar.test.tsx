// ABOUTME: Tests for the filter bar: year, tag, and status chips, search, result count, and clearing.
// ABOUTME: The bar is controlled; tests check the filters it asks for through onChange.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters.ts'
import { FilterBar } from './FilterBar.tsx'

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...overrides }
}

function renderBar(current: Filters = DEFAULT_FILTERS, resultCount = 26) {
  const onChange = vi.fn()
  render(
    <FilterBar
      filters={current}
      years={[2025, 2024, 2023]}
      tags={['fiction', 'kids’ books', 'sci fi, fantasy & speculative fiction']}
      resultCount={resultCount}
      onChange={onChange}
    />,
  )
  return { onChange, user: userEvent.setup() }
}

function chip(label: string, groupName: string) {
  return within(screen.getByRole('group', { name: groupName })).getByRole('button', { name: label })
}

describe('FilterBar', () => {
  it('shows each year, newest first, with none selected by default', () => {
    renderBar()

    const years = within(screen.getByRole('group', { name: 'Years' })).getAllByRole('button')
    expect(years.map((button) => button.textContent)).toEqual(['2025', '2024', '2023'])
    expect(years.every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('selects a year', async () => {
    const { onChange, user } = renderBar()

    await user.click(chip('2024', 'Years'))

    expect(onChange).toHaveBeenCalledWith(filters({ years: [2024] }))
  })

  it('deselects a selected year', async () => {
    const { onChange, user } = renderBar(filters({ years: [2024, 2023] }))

    expect(chip('2024', 'Years')).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip('2024', 'Years'))

    expect(onChange).toHaveBeenCalledWith(filters({ years: [2023] }))
  })

  it('selects and deselects tags', async () => {
    const { onChange, user } = renderBar(filters({ tags: ['fiction'] }))

    await user.click(chip('sci fi, fantasy & speculative fiction', 'Tags'))
    await user.click(chip('fiction', 'Tags'))

    expect(onChange).toHaveBeenNthCalledWith(1, filters({ tags: ['fiction', 'sci fi, fantasy & speculative fiction'] }))
    expect(onChange).toHaveBeenNthCalledWith(2, filters({ tags: [] }))
  })

  it('shows which statuses are included, hiding dismissed books by default', () => {
    renderBar()

    const group = within(screen.getByRole('group', { name: 'Status' }))
    expect(group.getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Unmarked', 'true'],
      ['Want to read', 'true'],
      ['Read', 'true'],
      ['Dismissed', 'false'],
    ])
  })

  it('switches a status on and off', async () => {
    const { onChange, user } = renderBar()

    await user.click(chip('Dismissed', 'Status'))
    await user.click(chip('Read', 'Status'))

    expect(onChange).toHaveBeenNthCalledWith(1, filters({ statuses: ['unmarked', 'want_to_read', 'read', 'dismissed'] }))
    expect(onChange).toHaveBeenNthCalledWith(2, filters({ statuses: ['unmarked', 'want_to_read'] }))
  })

  it('does not let the last included status be switched off', () => {
    renderBar(filters({ statuses: ['read'] }))

    expect(chip('Read', 'Status')).toBeDisabled()
  })

  it('searches as the reader types, replacing the history entry rather than adding one per keystroke', async () => {
    const { onChange, user } = renderBar()

    await user.type(screen.getByRole('searchbox', { name: 'Search titles and authors' }), 'b')

    expect(onChange).toHaveBeenCalledWith(filters({ search: 'b' }), { replace: true })
  })

  it('notes that search covers every year when a search is active', () => {
    renderBar(filters({ years: [2024], search: 'baldwin' }))

    expect(screen.getByText('Searching all years')).toBeInTheDocument()
  })

  it.each([
    [26, '26 books'],
    [1, '1 book'],
    [0, 'No books match'],
  ])('shows a count of %i as "%s"', (count, text) => {
    renderBar(DEFAULT_FILTERS, count)

    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('clears every filter', async () => {
    const { onChange, user } = renderBar(filters({ years: [2024], tags: ['fiction'], search: 'x', statuses: ['read'] }))

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS)
  })

  it('disables clearing when the filters are already the defaults', () => {
    renderBar()

    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDisabled()
  })
})
