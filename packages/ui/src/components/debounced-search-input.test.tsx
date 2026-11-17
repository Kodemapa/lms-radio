import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DebouncedSearchInput } from './debounced-search-input';

describe('DebouncedSearchInput', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('submits the parent form after typing pauses', () => {
    vi.useFakeTimers();
    const requestSubmit = vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(() => undefined);
    render(
      <form>
        <DebouncedSearchInput id="search" name="q" label="Search" placeholder="Search users" value="" autoSubmit />
      </form>,
    );
    const input = screen.getByRole('searchbox', { name: 'Search' });

    fireEvent.change(input, { target: { value: 'a' } });
    act(() => vi.advanceTimersByTime(200));
    fireEvent.change(input, { target: { value: 'asha' } });
    act(() => vi.advanceTimersByTime(299));
    expect(requestSubmit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(requestSubmit).toHaveBeenCalledTimes(1);
  });
});
