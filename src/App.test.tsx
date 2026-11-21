// ABOUTME: Tests for the root App component.
// ABOUTME: Verifies the app shell renders.

import { render, screen } from '@testing-library/react'
import App from './App.tsx'

describe('App', () => {
  it('renders the app name as the main heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'shelf-life' })).toBeInTheDocument()
  })
})
