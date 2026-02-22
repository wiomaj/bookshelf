import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// One singleton browser client for the whole app.
// RLS policies on the `books` table ensure users only see their own data.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
