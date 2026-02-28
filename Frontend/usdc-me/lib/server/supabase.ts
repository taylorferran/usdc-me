import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client for use in API routes only.
 * Never exposed to the browser — uses the service role key that bypasses RLS.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
