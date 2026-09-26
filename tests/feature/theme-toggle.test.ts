/**
 * Theme Toggle Tests
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../client/src/test/utils';
import ThemeToggle from '../../client/src/components/theme/ThemeToggle';

describe('ThemeToggle', () => {
  it('should render toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
