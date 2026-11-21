// ABOUTME: Switch between the cover grid and the compact list.
// ABOUTME: Shows the active view as pressed.

import type { ViewMode } from './useViewMode.ts'

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: 'grid', label: 'Grid' },
  { mode: 'list', label: 'List' },
]

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div role="group" aria-label="View" className="inline-flex overflow-hidden rounded-md border border-gray-300">
      {VIEWS.map((view) => (
        <button
          key={view.mode}
          type="button"
          aria-pressed={mode === view.mode}
          onClick={() => onChange(view.mode)}
          className={`px-3 py-1 text-sm ${mode === view.mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
        >
          {view.label}
        </button>
      ))}
    </div>
  )
}
