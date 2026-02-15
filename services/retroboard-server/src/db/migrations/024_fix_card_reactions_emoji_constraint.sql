-- Migration: 024_fix_card_reactions_emoji_constraint
-- Description: Fix card_reactions emoji constraint to use Unicode emoji instead of text names
-- Created: 2026-02-15
-- Fixes: Bug #10 - Reactions endpoint returns 500 for all valid emoji

-- Drop the incorrect constraint
ALTER TABLE card_reactions DROP CONSTRAINT IF EXISTS chk_card_reactions_emoji_valid;

-- Add the correct constraint with Unicode emoji characters
ALTER TABLE card_reactions
    ADD CONSTRAINT chk_card_reactions_emoji_valid
    CHECK (emoji IN ('👍', '👎', '❤️', '🔥', '🤔', '😂', '💯', '👀', '🎉', '✅', '😀', '🚀'));
