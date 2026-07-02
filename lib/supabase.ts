/**
 * Optional Supabase client wrapper.
 * The app works 100% without it (pure offline with Dexie + outbox queue).
 * 
 * To enable multi-device sync:
 * 1. Create a Supabase project
 * 2. Copy .env.example to .env.local and fill in the values below
 * 3. Run the SQL schema from the README
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const isSupabaseConfigured = !!supabase;
