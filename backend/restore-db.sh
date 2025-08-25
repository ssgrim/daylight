#!/bin/bash
# Restore script for backend SQLite database
# Usage: ./restore-db.sh <backup-file>

set -e
BACKUP_FILE="$1"
DB_PATH="$(dirname "$0")/backend/external_history.sqlite"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

cp "$BACKUP_FILE" "$DB_PATH"
echo "Database restored from $BACKUP_FILE to $DB_PATH"
