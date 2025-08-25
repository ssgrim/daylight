import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Plan from '../pages/Plan'

describe('Plan page', () => {
  it('renders the Plan page', () => {
    render(<Plan />)
    expect(screen.getByText(/plan/i)).toBeInTheDocument()
  })
})
