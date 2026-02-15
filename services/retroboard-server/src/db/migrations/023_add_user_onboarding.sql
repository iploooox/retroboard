-- Migration: 023_add_user_onboarding
-- Description: Add onboarding tracking columns to users table
-- Created: 2026-02-15

ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN onboarding_data JSONB;
