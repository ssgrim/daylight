#!/bin/bash
# Backup script for backend SQLite database
# Usage: ./backup-db.sh [backup-dir]

set -e
BACKUP_DIR=${1:-"$(dirname "$0")/backups"}
DB_PATH="$(dirname "$0")/backend/external_history.sqlite"
DATE=$(date +"%Y%m%d-%H%M%S")

mkdir -p "$BACKUP_DIR"
if [ -f "$DB_PATH" ]; then
  cp "$DB_PATH" "$BACKUP_DIR/external_history-$DATE.sqlite"
  echo "Backup complete: $BACKUP_DIR/external_history-$DATE.sqlite"
else
  echo "Database not found: $DB_PATH"
  exit 1
fi
