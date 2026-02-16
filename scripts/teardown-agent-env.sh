#!/usr/bin/env bash
#
# teardown-agent-env.sh — Remove an agent's isolated environment.
#
# Removes: git worktree, branch, PostgreSQL database.
#
# Usage:
#   ./scripts/teardown-agent-env.sh <agent-number>
#   ./scripts/teardown-agent-env.sh --all              # tear down all agent worktrees
#
# Examples:
#   ./scripts/teardown-agent-env.sh 1
#   ./scripts/teardown-agent-env.sh --all

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ---------------------------------------------------------------------------
# Helper: tear down a single agent
# ---------------------------------------------------------------------------

teardown_agent() {
  local AGENT_NUM="$1"
  local WORKTREE_DIR="$REPO_ROOT/.worktrees/agent-$AGENT_NUM"
  local DB_NAME="retroboard_agent_$AGENT_NUM"

  echo "------------------------------------------------------------"
  echo "  Tearing down Agent $AGENT_NUM"
  echo "------------------------------------------------------------"

  # ------------------------------------------------------------------
  # Step 1: Kill any processes using the agent's ports
  # ------------------------------------------------------------------

  local SERVER_PORT=$((3000 + AGENT_NUM))
  local FRONTEND_PORT=$((5173 + AGENT_NUM))

  for PORT in $SERVER_PORT $FRONTEND_PORT; do
    local PIDS
    PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [[ -n "$PIDS" ]]; then
      echo "  Killing processes on port $PORT: $PIDS"
      echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
  done

  # ------------------------------------------------------------------
  # Step 2: Remove git worktree
  # ------------------------------------------------------------------

  if [[ -d "$WORKTREE_DIR" ]]; then
    echo "  Removing worktree at $WORKTREE_DIR..."
    git -C "$REPO_ROOT" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || {
      # If git worktree remove fails, do it manually
      rm -rf "$WORKTREE_DIR"
      git -C "$REPO_ROOT" worktree prune
    }
    echo "  Worktree removed."
  else
    echo "  No worktree found at $WORKTREE_DIR — skipping."
  fi

  # ------------------------------------------------------------------
  # Step 3: Delete the agent branch (all agent-N/* branches)
  # ------------------------------------------------------------------

  local BRANCHES
  BRANCHES=$(git -C "$REPO_ROOT" branch --list "agent-$AGENT_NUM/*" 2>/dev/null || true)
  if [[ -n "$BRANCHES" ]]; then
    echo "  Deleting branches:"
    echo "$BRANCHES" | while read -r BRANCH; do
      BRANCH="$(echo "$BRANCH" | sed 's/^[* ]*//')"
      if [[ -n "$BRANCH" ]]; then
        echo "    $BRANCH"
        git -C "$REPO_ROOT" branch -D "$BRANCH" 2>/dev/null || true
      fi
    done
  else
    echo "  No agent-$AGENT_NUM/* branches found — skipping."
  fi

  # ------------------------------------------------------------------
  # Step 4: Drop PostgreSQL database
  # ------------------------------------------------------------------

  if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "  Dropping database $DB_NAME..."

    # Terminate any active connections first
    psql -d postgres -c "
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
    " >/dev/null 2>&1 || true

    dropdb "$DB_NAME"
    echo "  Database $DB_NAME dropped."
  else
    echo "  Database $DB_NAME does not exist — skipping."
  fi

  echo "  Agent $AGENT_NUM torn down."
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

ARG="${1:-}"

if [[ -z "$ARG" ]]; then
  echo "Usage: $0 <agent-number>"
  echo "       $0 --all"
  exit 1
fi

if [[ "$ARG" == "--all" ]]; then
  echo "============================================================"
  echo "  Tearing down ALL agent environments"
  echo "============================================================"
  echo ""

  # Find all agent worktree directories
  FOUND_ANY=false
  if [[ -d "$REPO_ROOT/.worktrees" ]]; then
    for DIR in "$REPO_ROOT/.worktrees"/agent-*; do
      if [[ -d "$DIR" ]]; then
        # Extract agent number from directory name
        NUM=$(basename "$DIR" | sed 's/agent-//')
        if [[ "$NUM" =~ ^[0-9]+$ ]]; then
          teardown_agent "$NUM"
          FOUND_ANY=true
        fi
      fi
    done
  fi

  # Also check for databases that might exist without worktrees
  AGENT_DBS=$(psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -o 'retroboard_agent_[0-9]*' || true)
  for DB in $AGENT_DBS; do
    NUM=$(echo "$DB" | sed 's/retroboard_agent_//')
    if [[ "$NUM" =~ ^[0-9]+$ ]]; then
      # Only teardown if not already handled
      if [[ ! -d "$REPO_ROOT/.worktrees/agent-$NUM" ]]; then
        teardown_agent "$NUM"
        FOUND_ANY=true
      fi
    fi
  done

  if [[ "$FOUND_ANY" == false ]]; then
    echo "  No agent environments found."
  fi

  # Clean up empty .worktrees directory
  if [[ -d "$REPO_ROOT/.worktrees" ]]; then
    rmdir "$REPO_ROOT/.worktrees" 2>/dev/null || true
  fi

  # Prune stale worktree references
  git -C "$REPO_ROOT" worktree prune 2>/dev/null || true

  echo "============================================================"
  echo "  All agent environments torn down."
  echo "============================================================"
else
  if ! [[ "$ARG" =~ ^[0-9]+$ ]]; then
    echo "Error: argument must be an agent number (integer) or --all"
    exit 1
  fi

  teardown_agent "$ARG"

  # Prune stale worktree references
  git -C "$REPO_ROOT" worktree prune 2>/dev/null || true

  # Clean up empty .worktrees directory
  if [[ -d "$REPO_ROOT/.worktrees" ]] && [[ -z "$(ls -A "$REPO_ROOT/.worktrees" 2>/dev/null)" ]]; then
    rmdir "$REPO_ROOT/.worktrees" 2>/dev/null || true
  fi
fi
