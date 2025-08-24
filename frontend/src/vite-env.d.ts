/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN: string
  readonly VITE_SENTRY_RELEASE: string
  readonly VITE_NODE_ENV: string
  readonly VITE_GIT_SHA: string
  readonly VITE_API_BASE: string
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Global variables defined in vite.config.ts
declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string
declare const __GIT_SHA__: string
