import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_TENDER_TRACKER_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.TENDER_TRACKER_SUPABASE_SERVICE_ROLE_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !anonKey) {
    return null;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false }
  });
}
