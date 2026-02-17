import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BoardPage } from '@/pages/BoardPage';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import type { BoardData } from '@/lib/board-api';

// Mock the child components to isolate page testing
vi.mock('@/components/board/BoardHeader', () => ({
  BoardHeader: ({ isFacilitator }: { isFacilitator: boolean }) => (
    <div data-testid="board-header">
      Header {isFacilitator ? '(facilitator)' : '(member)'}
    </div>
  ),
}));

vi.mock('@/components/board/BoardColumn', () => ({
  BoardColumn: ({ name }: { name: string }) => (
    <div data-testid="board-column">{name}</div>
  ),
}));

vi.mock('@/components/board/GroupManager', () => ({
  GroupManager: () => <div data-testid="group-manager" />,
}));

vi.mock('@/components/board/ActionItemsPanel', () => ({
  ActionItemsPanel: () => <div data-testid="action-items-panel" />,
}));

vi.mock('@/components/board/BoardSettingsModal', () => ({
  BoardSettingsModal: () => <div data-testid="settings-modal" />,
}));

vi.mock('@/components/board/CreateBoardModal', () => ({
  CreateBoardModal: () => <div data-testid="create-board-modal" />,
}));

vi.mock('@/components/board/IcebreakerWarmup', () => ({
  IcebreakerWarmup: () => <div data-testid="icebreaker-warmup" />,
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      get: vi.fn().mockResolvedValue({ members: [{ user: { id: 'user-1' }, role: 'facilitator' }] }),
    },
  };
});

const mockBoardData: BoardData = {
  id: 'board-1',
  sprint_id: 'sprint-1',
  template_id: 'tpl-1',
  phase: 'discuss',
  anonymous_mode: false,
  max_votes_per_user: 5,
  max_votes_per_card: 3,
  focus_item_id: null,
  focus_item_type: null,
  icebreaker_id: null,
  icebreaker_active: true,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
  columns: [
    {
      id: 'col-1', board_id: 'board-1', name: 'What Went Well', color: '#22c55e', position: 0,
      created_at: '', cards: [],
    },
    {
      id: 'col-2', board_id: 'board-1', name: 'Improvements', color: '#ef4444', position: 1,
      created_at: '', cards: [],
    },
  ],
  groups: [],
  user_votes_remaining: 5,
  user_total_votes_cast: 0,
};

function renderBoardPage(teamId = 'team-1', sprintId = 'sprint-1') {
  return render(
    <MemoryRouter initialEntries={[`/teams/${teamId}/sprints/${sprintId}/board`]}>
      <Routes>
        <Route path="/teams/:teamId/sprints/:sprintId/board" element={<BoardPage />} />
        <Route path="/teams/:teamId" element={<div>Team Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Mock boardApi at the module level so fetchBoard works predictably
vi.mock('@/lib/board-api', () => ({
  boardApi: {
    getBoard: vi.fn(),
    createBoard: vi.fn(),
    updateBoard: vi.fn(),
    addCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    vote: vi.fn(),
    removeVote: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    setPhase: vi.fn(),
    setFocus: vi.fn(),
    getActionItems: vi.fn(),
    createActionItem: vi.fn(),
    updateActionItem: vi.fn(),
    deleteActionItem: vi.fn(),
    carryOverActionItems: vi.fn(),
  },
}));

describe('BoardPage', () => {
  beforeEach(() => {
    useBoardStore.getState().reset();
    vi.clearAllMocks();

    // Set up authenticated user
    useAuthStore.setState({
      user: { id: 'user-1', email: 'test@test.com', display_name: 'Test User', avatar_url: null, created_at: '', onboarding_completed_at: null },
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it('shows loading spinner initially', async () => {
    // Make getBoard hang so it stays in loading state
    const { boardApi } = await import('@/lib/board-api');
    vi.mocked(boardApi.getBoard).mockReturnValue(new Promise(() => {}));

    renderBoardPage();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders board columns when data is loaded', async () => {
    const { boardApi } = await import('@/lib/board-api');
    vi.mocked(boardApi.getBoard).mockResolvedValue(mockBoardData);

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('What Went Well')).toBeTruthy();
    });
    expect(screen.getByText('Improvements')).toBeTruthy();
    expect(screen.getByTestId('board-header')).toBeTruthy();
  });

  it('shows error state when board fails to load', async () => {
    const { boardApi } = await import('@/lib/board-api');
    vi.mocked(boardApi.getBoard).mockRejectedValue(new Error('Something went wrong'));

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load board')).toBeTruthy();
    });
  });

  it('shows "No Board Yet" when board not found', async () => {
    const { boardApi } = await import('@/lib/board-api');
    const { ApiError } = await import('@/lib/api');
    vi.mocked(boardApi.getBoard).mockRejectedValue(new ApiError(404, 'BOARD_NOT_FOUND', 'Board not found'));

    renderBoardPage();

    await waitFor(() => {
      expect(screen.getByText('No Board Yet')).toBeTruthy();
    });
  });
});
