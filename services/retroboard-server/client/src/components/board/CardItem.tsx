import { useState } from 'react';
import { Pencil, Trash2, ThumbsUp, X, Check } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import type { BoardCard } from '@/lib/board-api';

interface CardItemProps {
  card: BoardCard;
  isFacilitator: boolean;
}

export function CardItem({ card, isFacilitator }: CardItemProps) {
  const user = useAuthStore((s) => s.user);
  const board = useBoardStore((s) => s.board);
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const voteOnCard = useBoardStore((s) => s.voteOnCard);
  const removeVoteFromCard = useBoardStore((s) => s.removeVoteFromCard);
  const userVotesRemaining = useBoardStore((s) => s.userVotesRemaining);
  const userCardVotes = useBoardStore((s) => s.userCardVotes);
  const setFocus = useBoardStore((s) => s.setFocus);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(card.content);

  if (!board) return null;

  const isOwner = user?.id === card.author_id;
  const canEdit = isOwner || isFacilitator;
  const phase = board.phase;
  const isWritePhase = phase === 'write';
  const isVotePhase = phase === 'vote';
  const isDiscussPhase = phase === 'discuss';
  const isFocused = board.focus_item_id === card.id && board.focus_item_type === 'card';

  const cardUserVotes = userCardVotes[card.id] ?? 0;
  const canVote = isVotePhase && userVotesRemaining > 0 && cardUserVotes < board.max_votes_per_card;
  const canUnvote = isVotePhase && cardUserVotes > 0;

  const authorDisplay = board.anonymous_mode && !isOwner && !isFacilitator
    ? 'Anonymous'
    : (card.author_name ?? 'Anonymous');

  const handleSaveEdit = async () => {
    if (editContent.trim() && editContent.trim() !== card.content) {
      try {
        await updateCard(card.id, editContent.trim());
      } catch {
        // Error handled in store
      }
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    try {
      await deleteCard(card.id);
    } catch {
      // Error handled in store
    }
  };

  const handleVote = async () => {
    try {
      await voteOnCard(card.id);
    } catch {
      // Error handled in store
    }
  };

  const handleUnvote = async () => {
    try {
      await removeVoteFromCard(card.id);
    } catch {
      // Error handled in store
    }
  };

  const handleFocus = () => {
    if (isDiscussPhase && isFacilitator) {
      if (isFocused) {
        setFocus(null, null);
      } else {
        setFocus(card.id, 'card');
      }
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        isFocused
          ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
          : 'border-slate-200 bg-white hover:border-slate-300'
      } ${isDiscussPhase && isFacilitator ? 'cursor-pointer' : ''}`}
      onClick={isDiscussPhase && isFacilitator && !isEditing ? handleFocus : undefined}
    >
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded hover:bg-slate-100 text-slate-400"
              aria-label="Cancel editing"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleSaveEdit}
              className="p-1 rounded hover:bg-indigo-100 text-indigo-600"
              aria-label="Save changes"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{card.content}</p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400">{authorDisplay}</span>
            <div className="flex items-center gap-1">
              {(isVotePhase || card.vote_count > 0) && (
                <div className="flex items-center gap-1">
                  {canUnvote && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnvote(); }}
                      className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                      aria-label="Remove vote"
                    >
                      <ThumbsUp className="h-3.5 w-3.5 fill-current" />
                    </button>
                  )}
                  {canVote && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVote(); }}
                      className="p-1 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600"
                      aria-label="Vote"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {card.vote_count > 0 && (
                    <span className="text-xs font-medium text-slate-500 ml-0.5">
                      {card.vote_count}
                    </span>
                  )}
                </div>
              )}
              {canEdit && isWritePhase && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditContent(card.content);
                      setIsEditing(true);
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    aria-label="Edit card"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                    aria-label="Delete card"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
