# Database Backup & Disaster Recovery

## Automated Backups
- Use `backend/backup-db.sh` to create a timestamped backup of the SQLite database.
- Backups are stored in `backend/backups/` by default.
- Example:
  ```sh
  ./backup-db.sh
  ```
  or specify a custom directory:
  ```sh
  ./backup-db.sh /path/to/backupdir
  ```

## Restore Process
- Use `backend/restore-db.sh` to restore from a backup file.
- Example:
  ```sh
  ./restore-db.sh backups/external_history-YYYYMMDD-HHMMSS.sqlite
  ```

## Disaster Recovery
- Store backup files in a remote/cloud location (e.g., S3, another server) for extra safety.
- Test restore regularly to ensure backups are valid.
- Document and automate backup/restore in production environments.

## Notes
- These scripts are for the SQLite database at `backend/backend/external_history.sqlite`.
- For production, consider automating uploads to S3 or another remote storage.
