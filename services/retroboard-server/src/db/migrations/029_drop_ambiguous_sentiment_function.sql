-- Migration: 029_drop_ambiguous_sentiment_function
-- Description: Drop the old 1-parameter calculate_card_sentiment(text) function
-- that conflicts with the 2-parameter version from migration 026.
-- PostgreSQL cannot disambiguate the call when both exist.

DROP FUNCTION IF EXISTS calculate_card_sentiment(text);
