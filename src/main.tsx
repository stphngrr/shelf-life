// ABOUTME: Application entry point.
// ABOUTME: Mounts the React root and wraps the app in its Supabase and query providers.

import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { SupabaseProvider } from './data/SupabaseProvider.tsx'
import { createAppSupabaseClientFromEnv } from './data/supabaseClient.ts'
import { createQueryClient } from './queryClient.ts'
import './index.css'

const supabase = createAppSupabaseClientFromEnv(import.meta.env)
const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SupabaseProvider client={supabase}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </SupabaseProvider>
  </StrictMode>,
)
