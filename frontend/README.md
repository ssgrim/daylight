# Daylight Frontend

## Runtime API Base Configuration

The app loads `/env.json` at runtime to determine the API base URL. This allows you to change the backend API endpoint without rebuilding or redeploying the frontend.

### How it works

- On app startup, `/env.json` is fetched with `no-cache`.
- If `API_BASE` (or legacy `API_BASE_URL`) is present, it is used as the API base.
- If not, the app falls back to the build-time `import.meta.env.VITE_API_BASE`.

### To update the API base URL

1. Edit `frontend/public/env.json` (or your deployed `/env.json`) and set:
   ```json
   { "API_BASE": "https://your-new-api-base.example.com" }
   ```
2. Save and upload the file to your static hosting (S3, CloudFront, etc) as `/env.json`.
3. Users will pick up the new API base on next reload (no cache).

No redeploy or rebuild is required for API endpoint changes.
