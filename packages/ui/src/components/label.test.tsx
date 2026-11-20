import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from './label';

describe('Label', () => {
  it('marks required fields with an asterisk that screen readers skip', () => {
    render(<Label htmlFor="name" required>Full name</Label>);
    const star = screen.getByText('*');
    expect(star.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Full name').tagName).toBe('LABEL');
  });

  it('shows no asterisk on optional fields', () => {
    render(<Label htmlFor="phone">Phone</Label>);
    expect(screen.queryByText('*')).toBeNull();
  });
});
