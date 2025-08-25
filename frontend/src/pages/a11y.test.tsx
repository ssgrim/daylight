import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'
import '@testing-library/jest-dom'
import Root from '../pages/Root'
import Plan from '../pages/Plan'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

// Mock the Map component for testing
vi.mock('../components/Map', () => ({
  default: () => <div data-testid="mock-map">Map Component</div>
}))

describe('Accessibility', () => {
  it('Root page is accessible', async () => {
    const { container } = render(
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  it('Plan page is accessible', async () => {
    const { container } = render(<Plan />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
