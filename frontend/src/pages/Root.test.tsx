import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Root from '../pages/Root'

describe('Root page', () => {
  it('renders the app root', () => {
    render(<Root />)
    expect(screen.getByText(/daylight/i)).toBeInTheDocument()
  })
})
