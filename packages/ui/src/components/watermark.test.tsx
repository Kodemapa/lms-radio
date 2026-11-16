import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedSurface, isCaptureShortcut } from './protected-surface';
import { Watermark } from './watermark';

describe('Watermark', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows identifying lines and a live timestamp', () => {
    render(<Watermark lines={['Dr Asha Rao', 'u:1a2b3c4d']} />);
    const mark = screen.getByTestId('watermark');
    expect(mark).toHaveProperty('ariaHidden', 'true');
    expect(mark.textContent).toContain('Dr Asha Rao');
    expect(mark.textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC/);
  });

  it('moves over time', () => {
    render(<Watermark lines={['x']} moveEveryMs={1000} />);
    const inner = screen.getByTestId('watermark').firstElementChild as HTMLElement;
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      seen.add(inner.style.top + inner.style.left);
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('ProtectedSurface', () => {
  it('blocks the context menu', () => {
    render(
      <ProtectedSurface watermarkLines={['x']}>
        <p>content</p>
      </ProtectedSurface>,
    );
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    screen.getByText('content').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('capture shield', () => {
  const renderSurface = (onShieldChange = vi.fn()) => {
    render(
      <ProtectedSurface watermarkLines={['x']} onShieldChange={onShieldChange}>
        <p>content</p>
      </ProtectedSurface>,
    );
    return onShieldChange;
  };

  it('recognises screenshot shortcuts', () => {
    expect(isCaptureShortcut({ key: 'PrintScreen', metaKey: false, shiftKey: false })).toBe(true);
    expect(isCaptureShortcut({ key: 'Shift', metaKey: true, shiftKey: true })).toBe(true);
    expect(isCaptureShortcut({ key: 's', metaKey: true, shiftKey: false })).toBe(false);
  });

  it('blanks content on a screenshot shortcut until the learner clicks', () => {
    const onShieldChange = renderSurface();
    fireEvent.keyDown(window, { key: 'Shift', metaKey: true, shiftKey: true });
    const shield = screen.getByTestId('capture-shield');
    expect(onShieldChange).toHaveBeenLastCalledWith('capture');
    // Focus returning does not lower a capture shield.
    fireEvent.focus(window);
    expect(screen.getByTestId('capture-shield')).toBeTruthy();
    fireEvent.click(shield);
    expect(screen.queryByTestId('capture-shield')).toBeNull();
    expect(onShieldChange).toHaveBeenLastCalledWith(null);
  });

  it('blanks content while printing', () => {
    renderSurface();
    fireEvent(window, new Event('beforeprint'));
    expect(screen.getByTestId('capture-shield').textContent).toMatch(/Printing/);
    fireEvent(window, new Event('afterprint'));
    expect(screen.queryByTestId('capture-shield')).toBeNull();
  });

  it('can be turned off', () => {
    render(
      <ProtectedSurface watermarkLines={['x']} shield={false}>
        <p>content</p>
      </ProtectedSurface>,
    );
    fireEvent.keyDown(window, { key: 'PrintScreen' });
    expect(screen.queryByTestId('capture-shield')).toBeNull();
  });
});
