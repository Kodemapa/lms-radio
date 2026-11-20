 import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Toaster, currentToasts, dismissToast, toast, toastAfterReload } from './toast';

describe('toast', () => {
  afterEach(() => {
    act(() => currentToasts().forEach((item) => dismissToast(item.id)));
    vi.useRealTimers();
  });

  it('shows success messages politely and errors as alerts', () => {
    render(<Toaster closeLabel="Dismiss" />);
    act(() => {
      toast.success('Course saved.');
      toast.error('Something went wrong.');
    });
    expect(screen.getByText('Course saved.').closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong.');
  });

  it('closes on its own after a few seconds, or when dismissed', () => {
    vi.useFakeTimers();
    render(<Toaster closeLabel="Dismiss" />);
    act(() => {
      toast.success('Deleted.');
      toast.info('Heads up.');
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[1]!);
    expect(screen.queryByText('Heads up.')).toBeNull();
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Deleted.')).toBeNull();
  });

  it('keeps only the latest few toasts', () => {
    act(() => {
      for (let i = 0; i < 6; i++) toast(`Message ${i}`);
    });
    expect(currentToasts().map((item) => item.message)).toEqual(['Message 2', 'Message 3', 'Message 4', 'Message 5']);
  });

  it('shows a toast saved before a full page load once the next page renders', () => {
    toastAfterReload('success', 'Signed out.');
    render(<Toaster closeLabel="Dismiss" />);
    expect(screen.getByText('Signed out.')).toBeTruthy();
    expect(sessionStorage.getItem('obgyn:pending-toast')).toBeNull();
  });
});
