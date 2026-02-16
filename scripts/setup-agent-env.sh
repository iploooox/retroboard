#!/usr/bin/env bash
#
# setup-agent-env.sh — Create an isolated environment for a parallel dev agent.
#
# Creates: git worktree, PostgreSQL database, installs deps, runs migrations/seeds.
# Prints the environment variables the agent needs.
#
# Usage:
#   ./scripts/setup-agent-env.sh <agent-number> [task-description]
#
# Examples:
#   ./scripts/setup-agent-env.sh 1 fix-timer-sync
#   ./scripts/setup-agent-env.sh 2 add-export-pdf
#   ./scripts/setup-agent-env.sh 3                    # defaults to "task"

set -euo pipefail

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------

AGENT_NUM="${1:-}"
TASK_DESC="${2:-task}"

if [[ -z "$AGENT_NUM" ]]; then
  echo "Usage: $0 <agent-number> [task-description]"
  echo "  agent-number: integer (1, 2, 3, ...)"
  echo "  task-description: short slug for the branch name (default: 'task')"
  exit 1
fi

if ! [[ "$AGENT_NUM" =~ ^[0-9]+$ ]]; then
  echo "Error: agent-number must be a positive integer, got '$AGENT_NUM'"
  exit 1
fi

# ---------------------------------------------------------------------------
# Derived values
# ---------------------------------------------------------------------------

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKTREE_DIR="$REPO_ROOT/.worktrees/agent-$AGENT_NUM"
BRANCH_NAME="agent-$AGENT_NUM/$TASK_DESC"
DB_NAME="retroboard_agent_$AGENT_NUM"
SERVER_PORT=$((3000 + AGENT_NUM))
FRONTEND_PORT=$((5173 + AGENT_NUM))
DATABASE_URL="postgres://localhost:5432/$DB_NAME"
JWT_SECRET="dev-secret-must-be-at-least-32-characters-long"
SERVER_DIR="$WORKTREE_DIR/services/retroboard-server"

echo "============================================================"
echo "  Setting up Agent $AGENT_NUM"
echo "============================================================"
echo ""
echo "  Worktree:  $WORKTREE_DIR"
echo "  Branch:    $BRANCH_NAME"
echo "  Database:  $DB_NAME"
echo "  Server:    http://localhost:$SERVER_PORT"
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create git worktree
# ---------------------------------------------------------------------------

echo "[1/6] Creating git worktree..."

if [[ -d "$WORKTREE_DIR" ]]; then
  echo "  Worktree already exists at $WORKTREE_DIR — skipping creation."
else
  mkdir -p "$REPO_ROOT/.worktrees"

  # Check if branch already exists
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
    # Branch exists, create worktree using existing branch
    git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH_NAME"
  else
    # Create new branch from main
    git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" main
  fi

  echo "  Created worktree at $WORKTREE_DIR on branch $BRANCH_NAME"
fi

# ---------------------------------------------------------------------------
# Step 2: Create PostgreSQL database
# ---------------------------------------------------------------------------

echo "[2/6] Creating database $DB_NAME..."

if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "  Database $DB_NAME already exists — skipping creation."
else
  createdb "$DB_NAME"
  echo "  Created database $DB_NAME"
fi

# ---------------------------------------------------------------------------
# Step 3: Install dependencies in worktree
# ---------------------------------------------------------------------------

echo "[3/6] Installing server dependencies..."

if [[ -d "$SERVER_DIR/node_modules" ]]; then
  echo "  node_modules exists — skipping npm install."
else
  (cd "$SERVER_DIR" && npm install --silent)
  echo "  Server dependencies installed."
fi

echo "[4/6] Installing client dependencies..."

if [[ -d "$SERVER_DIR/client/node_modules" ]]; then
  echo "  client/node_modules exists — skipping npm install."
else
  (cd "$SERVER_DIR/client" && npm install --silent)
  echo "  Client dependencies installed."
fi

# ---------------------------------------------------------------------------
# Step 4: Run migrations and seeds
# ---------------------------------------------------------------------------

echo "[5/6] Running database migrations..."

(cd "$SERVER_DIR" && DATABASE_URL="$DATABASE_URL" npx tsx src/db/migrate.ts)

echo "[6/6] Running database seeds..."

(cd "$SERVER_DIR" && DATABASE_URL="$DATABASE_URL" npx tsx src/db/seed.ts)

# ---------------------------------------------------------------------------
# Step 5: Print environment summary
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  Agent $AGENT_NUM is ready!"
echo "============================================================"
echo ""
echo "Copy-paste these env vars into the agent's prompt:"
echo ""
echo "---"
echo ""
echo "## Agent $AGENT_NUM Environment"
echo ""
echo "Working directory: $SERVER_DIR"
echo "Branch: $BRANCH_NAME"
echo ""
echo "Environment variables (prefix to every command):"
echo ""
echo "  export DATABASE_URL=$DATABASE_URL"
echo "  export JWT_SECRET=$JWT_SECRET"
echo "  export PORT=$SERVER_PORT"
echo "  export NODE_ENV=development"
echo ""
echo "Start server:"
echo "  cd $SERVER_DIR"
echo "  DATABASE_URL=$DATABASE_URL JWT_SECRET=$JWT_SECRET PORT=$SERVER_PORT npm run dev"
echo ""
echo "Start frontend:"
echo "  cd $SERVER_DIR/client"
echo "  VITE_PORT=$FRONTEND_PORT VITE_API_PORT=$SERVER_PORT npx vite"
echo ""
echo "Run unit/integration tests:"
echo "  cd $SERVER_DIR"
echo "  DATABASE_URL=$DATABASE_URL JWT_SECRET=$JWT_SECRET npm test"
echo ""
echo "Run E2E browser tests:"
echo "  cd $SERVER_DIR"
echo "  PLAYWRIGHT_BASE_URL=http://localhost:$FRONTEND_PORT npx playwright test"
echo ""
echo "---"
