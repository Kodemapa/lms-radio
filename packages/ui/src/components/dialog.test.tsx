import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Dialog, DialogContent, DialogTitle } from './dialog';

function Form({ keepOpen }: { keepOpen: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent closeLabel="Close" keepOpenOnOutsideClick={keepOpen} aria-describedby={undefined}>
        <DialogTitle>Add instructor</DialogTitle>
        <input aria-label="Name" />
        <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      </DialogContent>
    </Dialog>
  );
}

describe('DialogContent keepOpenOnOutsideClick', () => {
  it('stays open on Escape and closes only with its own buttons', () => {
    render(<Form keepOpen />);
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
    expect(screen.queryByText('Add instructor')).not.toBeNull();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Add instructor')).toBeNull();
  });

  it('closes on Escape when the option is off', () => {
    render(<Form keepOpen={false} />);
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Escape' });
    expect(screen.queryByText('Add instructor')).toBeNull();
  });
});
