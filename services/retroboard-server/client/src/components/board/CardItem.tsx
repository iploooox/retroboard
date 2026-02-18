import { useState, useRef, useEffect, useCallback } from 'react';
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
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function CardItem({ card, isFacilitator, onCreateActionItem, isSelected, onToggleSelect }: CardItemProps) {
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
  const updateGroup = useBoardStore((s) => s.updateGroup);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(card.content);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerButtonRef = useRef<HTMLButtonElement>(null);

  const updatePickerPosition = useCallback(() => {
    if (pickerButtonRef.current) {
      const rect = pickerButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.top - 4, // Above the button with small gap
        left: rect.left,
      });
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current && !pickerRef.current.contains(event.target as Node) &&
        pickerButtonRef.current && !pickerButtonRef.current.contains(event.target as Node)
      ) {
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

  const isGroupPhase = phase === 'group';
  const isSelectable = isGroupPhase && isFacilitator && !card.group_id;

  const handleUngroup = async () => {
    if (!card.group_id) return;
    try {
      await updateGroup(card.group_id, { remove_card_ids: [card.id] });
    } catch {
      // Error handled in store
    }
  };

  const handleReactionClick = async (emoji: string) => {
    try {
      const result = await boardApi.toggleReaction(card.id, emoji);
      setShowReactionPicker(false);
      // Update card reactions immediately from API response
      useBoardStore.setState((state) => {
        const existing = state.cards[card.id];
        if (!existing) return state;
        return {
          cards: {
            ...state.cards,
            [card.id]: { ...existing, reactions: result.reactions },
          },
        };
      });
    } catch {
      toast.error('Failed to add reaction');
    }
  };

  return (
    <div
      className={`relative rounded-lg border p-3 transition-all ${
        isFocused
          ? 'ring-2 ring-indigo-200'
          : isSelected
            ? 'ring-2 ring-blue-300'
            : 'hover:shadow-sm'
      } ${isDiscussPhase && isFacilitator ? 'cursor-pointer' : ''} ${isSelectable ? 'cursor-pointer' : ''}`}
      style={{
        backgroundColor: isFocused ? '#eef2ff' : isSelected ? 'rgba(219,234,254,0.3)' : 'var(--theme-card-bg, #ffffff)',
        borderColor: isFocused ? '#818cf8' : isSelected ? '#93c5fd' : 'var(--theme-card-border, #e2e8f0)',
      }}
      onClick={
        isSelectable && !isEditing
          ? (e) => { e.stopPropagation(); onToggleSelect?.(); }
          : isDiscussPhase && isFacilitator && !isEditing
            ? handleFocus
            : undefined
      }
    >
      {/* Selection checkbox for ungrouped cards in group phase */}
      {isSelectable && (
        <div className="absolute -left-1.5 -top-1.5 z-10">
          <div className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white shadow-sm'
          }`}>
            {isSelected && <Check className="h-3 w-3" />}
          </div>
        </div>
      )}

      {/* Ungroup button for grouped cards in group phase */}
      {isGroupPhase && isFacilitator && card.group_id && (
        <button
          onClick={(e) => { e.stopPropagation(); handleUngroup(); }}
          className="absolute -top-1.5 -right-1.5 z-10 h-5 w-5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-300 transition-colors"
          aria-label="Remove from group"
        >
          <X className="h-3 w-3" />
        </button>
      )}

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
              {!isLocked && isWritePhase && (
                <div className="relative">
                  <button
                    ref={pickerButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!showReactionPicker) {
                        updatePickerPosition();
                      }
                      setShowReactionPicker(!showReactionPicker);
                    }}
                    className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                    aria-label="Add reaction"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                  {showReactionPicker && pickerPosition && (
                    <div
                      ref={pickerRef}
                      className="fixed bg-white rounded-lg shadow-lg border border-slate-200 p-2 grid grid-cols-6 gap-1"
                      style={{
                        top: pickerPosition.top,
                        left: pickerPosition.left,
                        transform: 'translateY(-100%)',
                        zIndex: 9999,
                      }}
                    >
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
                  {isVotePhase ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (cardUserVotes > 0) {
                          handleUnvote();
                        } else if (canVote) {
                          handleVote();
                        }
                      }}
                      disabled={cardUserVotes === 0 && !canVote}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                        cardUserVotes > 0
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                          : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                      aria-label={cardUserVotes > 0 ? 'Remove vote' : 'Vote'}
                    >
                      <ThumbsUp className={`h-3.5 w-3.5 ${cardUserVotes > 0 ? 'fill-current' : ''}`} />
                      {card.vote_count > 0 && (
                        <span className="text-xs font-medium" data-testid="card-votes">
                          {card.vote_count}
                        </span>
                      )}
                    </button>
                  ) : card.vote_count > 0 ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium" data-testid="card-votes" style={{ color: 'var(--theme-text-secondary, #475569)' }}>
                      <ThumbsUp className="h-3 w-3" />
                      {card.vote_count}
                    </span>
                  ) : null}
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
