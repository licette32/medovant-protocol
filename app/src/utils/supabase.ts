import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null | undefined

export function isSupabaseConfigured(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  return Boolean(url && anon)
}

export function getSupabase(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient
  cachedClient = isSupabaseConfigured()
    ? createClient(
        (import.meta.env.VITE_SUPABASE_URL as string).trim(),
        (import.meta.env.VITE_SUPABASE_ANON_KEY as string).trim()
      )
    : null
  return cachedClient
}