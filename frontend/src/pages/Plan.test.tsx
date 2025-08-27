// Core functionality test setup
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Plan from '../pages/Plan';

// Mock the Map component
vi.mock('../components/Map', () => ({
  default: () => <div>Mocked Map</div>,
}));

describe('Plan page', () => {
  it('renders the Plan page', () => {
    render(
      <BrowserRouter>
        <Plan />
      </BrowserRouter>
    );
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
  });
});
