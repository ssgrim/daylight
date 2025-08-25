import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import '@testing-library/jest-dom'
import Root from '../pages/Root'

describe('Root page', () => {
  it('renders the app root', () => {
    render(
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    )
    expect(screen.getByText(/daylight/i)).toBeInTheDocument()
  })
})
