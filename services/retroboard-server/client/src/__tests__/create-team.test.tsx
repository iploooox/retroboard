import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateTeamModal } from '../components/teams/CreateTeamModal';

describe('CreateTeamModal', () => {
  const originalFetch = global.fetch;
  const onClose = vi.fn();
  const onCreated = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onCreated.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should render form with name and description', () => {
    render(<CreateTeamModal open={true} onClose={onClose} onCreated={onCreated} />);
    expect(screen.getByRole('heading', { name: /create team/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('should disable submit when name is empty', () => {
    render(<CreateTeamModal open={true} onClose={onClose} onCreated={onCreated} />);
    const submitBtn = screen.getByRole('button', { name: /create team/i });
    expect(submitBtn).toBeDisabled();
  });

  it('should enable submit when name is provided', () => {
    render(<CreateTeamModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/team name/i), { target: { value: 'My Team' } });
    const submitBtn = screen.getByRole('button', { name: /create team/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('should call onCreated after successful submission', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ team: { id: '1', name: 'My Team' } }),
    });

    render(<CreateTeamModal open={true} onClose={onClose} onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText(/team name/i), { target: { value: 'My Team' } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
  });
});
