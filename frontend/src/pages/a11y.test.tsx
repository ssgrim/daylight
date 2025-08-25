import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import Root from '../pages/Root'
import Plan from '../pages/Plan'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Accessibility', () => {
  it('Root page is accessible', async () => {
    const { container } = render(<Root />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
  it('Plan page is accessible', async () => {
    const { container } = render(<Plan />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
