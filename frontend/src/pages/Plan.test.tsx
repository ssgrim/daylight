// Core functionality test setup
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Plan from '../pages/Plan';

// Mock the Map component
vi.mock('../components/Map', () => ({
  default: () => <div>Mocked Map</div>,
}));

describe('Plan page', () => {
  it('renders the Plan page', () => {
    render(<Plan />);
    expect(screen.getByText(/plan/i)).toBeInTheDocument();
  });
});
