// ABOUTME: Declares the environment variables Vite exposes to the app through import.meta.env.
// ABOUTME: Only VITE_-prefixed variables reach the browser bundle.

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}
