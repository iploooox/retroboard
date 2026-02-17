-- Migration: 030_add_icebreaker_board_phase
-- Description: Add 'icebreaker' to board_phase enum (must be separate transaction from usage)
-- Created: 2026-02-17

-- Add 'icebreaker' value to board_phase enum BEFORE 'write'
-- This must be committed before any references to 'icebreaker' in SQL
ALTER TYPE board_phase ADD VALUE IF NOT EXISTS 'icebreaker' BEFORE 'write';
