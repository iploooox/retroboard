-- Migration: 020_create_card_reactions
-- Description: Create card_reactions table for emoji reactions on cards
-- Created: 2026-02-15

CREATE TABLE IF NOT EXISTS card_reactions (
    id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID            NOT NULL,
    user_id    UUID            NOT NULL,
    emoji      VARCHAR(10)     NOT NULL,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_card_reactions_card
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
    CONSTRAINT fk_card_reactions_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_card_reactions_card_user_emoji
        UNIQUE (card_id, user_id, emoji),
    CONSTRAINT chk_card_reactions_emoji_valid
        CHECK (emoji IN ('thumbsup', 'thumbsdown', 'heart', 'fire', 'thinking', 'laughing', 'hundred', 'eyes'))
);

-- Indexes for card_reactions
CREATE INDEX IF NOT EXISTS idx_card_reactions_card_id ON card_reactions(card_id);
CREATE INDEX IF NOT EXISTS idx_card_reactions_user_id ON card_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_card_reactions_card_emoji ON card_reactions(card_id, emoji);
