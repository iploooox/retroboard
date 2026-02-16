import { useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, ThumbsUp, X, Check, Smile, FileCheck } from 'lucide-react';
import { useBoardStore } from '@/stores/board';
import { useAuthStore } from '@/stores/auth';
import { boardApi } from '@/lib/board-api';
import { toast } from '@/lib/toast';
import { calculateSentiment, getSentimentColor, getSentimentLabel } from '@/lib/sentiment';
import type { BoardCard } from '@/lib/board-api';

const REACTION_EMOJIS = ['👍', '👎', '❤️', '😂', '🎉', '🤔', '🔥', '👏', '✅', '❌', '💡', '🚀'];

interface CardItemProps {
  card: BoardCard;
  isFacilitator: boolean;
  onCreateActionItem?: (cardId: string, cardContent: string) => void;
}

export function CardItem({ card, isFacilitator, onCreateActionItem }: CardItemProps) {
  const user = useAuthStore((s) => s.user);
  const board = useBoardStore((s) => s.board);
  const isLocked = useBoardStore((s) => s.isLocked);
  const updateCard = useBoardStore((s) => s.updateCard);
  const deleteCard = useBoardStore((s) => s.deleteCard);
  const voteOnCard = useBoardStore((s) => s.voteOnCard);
  const removeVoteFromCard = useBoardStore((s) => s.removeVoteFromCard);
  const userVotesRemaining = useBoardStore((s) => s.userVotesRemaining);
  const userCardVotes = useBoardStore((s) => s.userCardVotes);
  const setFocus = useBoardStore((s) => s.setFocus);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(card.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    if (showReactionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReactionPicker]);

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

  const sentiment = calculateSentiment(card.content);
  const sentimentColor = getSentimentColor(sentiment);
  const sentimentLabel = getSentimentLabel(sentiment);

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

  const handleReactionClick = async (emoji: string) => {
    try {
      await boardApi.toggleReaction(card.id, emoji);
      setShowReactionPicker(false);
      // Reactions will be updated via WebSocket real-time sync
    } catch {
      toast.error('Failed to add reaction');
    }
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        isFocused
          ? 'ring-2 ring-indigo-200'
          : 'hover:shadow-sm'
      } ${isDiscussPhase && isFacilitator ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: isFocused ? '#eef2ff' : 'var(--theme-card-bg, #ffffff)',
        borderColor: isFocused ? '#818cf8' : 'var(--theme-card-border, #e2e8f0)',
      }}
      onClick={isDiscussPhase && isFacilitator && !isEditing ? handleFocus : undefined}
    >
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Edit card content"
            className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              }
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
          <p
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: 'var(--theme-text-primary, #1e293b)' }}
          >
            {card.content}
          </p>

          {/* Reactions */}
          {(card.reactions && card.reactions.length > 0) || !isLocked ? (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              {card.reactions?.map((reaction) => (
                <button
                  key={reaction.emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReactionClick(reaction.emoji);
                  }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
                    reaction.reacted
                      ? 'bg-indigo-100 hover:bg-indigo-200 text-indigo-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                  disabled={isLocked}
                  title={reaction.reacted ? 'Remove reaction' : 'Add reaction'}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-medium">{reaction.count}</span>
                </button>
              ))}
              {!isLocked && (
                <div className="relative" ref={pickerRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowReactionPicker(!showReactionPicker);
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    aria-label="Add reaction"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                  {showReactionPicker && (
                    <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-slate-200 p-2 grid grid-cols-6 gap-1 z-[1000]">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReactionClick(emoji);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 text-lg"
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--theme-text-muted, #64748b)' }}>{authorDisplay}</span>
              <div
                className={`h-1.5 w-1.5 rounded-full ${sentimentColor}`}
                title={sentimentLabel}
                aria-label={sentimentLabel}
              />
            </div>
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
                    <span className="text-xs font-medium ml-0.5" style={{ color: 'var(--theme-text-secondary, #475569)' }}>
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
                    disabled={isLocked}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                    aria-label="Delete card"
                    disabled={isLocked}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {onCreateActionItem && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateActionItem(card.id, card.content);
                      }}
                      className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                      aria-label="Create action item from card"
                      title="Create action item"
                      disabled={isLocked}
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
