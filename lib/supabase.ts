import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file.')
}

/**
 * Supabase client for use in the browser / Next.js client components.
 * Uses the publishable (anon) key — safe to expose in the browser.
 */
export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'accreditation',
  },
})

