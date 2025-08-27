import React from 'react'; // Ensure React is imported for JSX support
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/daylight/i)
  })
})
