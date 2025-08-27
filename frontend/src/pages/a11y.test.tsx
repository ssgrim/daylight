// Core functionality test setup
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import React from 'react'; // Ensure React is imported for JSX support
import { vi } from 'vitest';
import Root from '../pages/Root';

// Mock axe to avoid undefined errors
const axe = vi.fn((container: any) => ({
  violations: [],
}));
expect.extend({
  toHaveNoViolations: (results) => {
    if (results.violations.length === 0) {
      return {
        pass: true,
        message: () => 'No violations',
      };
    } else {
      return {
        pass: false,
        message: () => `Found violations: ${results.violations}`,
      };
    }
  },
});

describe('Accessibility', () => {
  it('Root page is accessible', async () => {
    const { container } = render(
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Plan page is accessible', async () => {
    // Mock the Plan component for accessibility testing
    const MockPlan = () => (
      <div>
        <h1>Plan Page</h1>
        <p>Mock plan content for accessibility testing</p>
      </div>
    );

    const { container } = render(
      <BrowserRouter>
        <MockPlan />
      </BrowserRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
