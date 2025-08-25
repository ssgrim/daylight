import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import '@testing-library/jest-dom'
import Plan from '../pages/Plan'

// Mock the Map component
vi.mock('../components/Map', () => ({
  default: () => <div data-testid="mock-map">Map Component</div>
}))

describe('Plan page', () => {
  it('renders the Plan page', () => {
    render(<Plan />)
    expect(screen.getByText(/plan/i)).toBeInTheDocument()
  })
})
