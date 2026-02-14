-- Migration: 001_create_extensions
-- Description: Enable required PostgreSQL extensions
-- Created: 2026-02-14

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
