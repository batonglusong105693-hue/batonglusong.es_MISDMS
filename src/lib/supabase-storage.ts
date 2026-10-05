import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "dms-files";

let storageClient: SupabaseClient | undefined;

export function getSupabaseStorage(): SupabaseClient {
  if (storageClient) return storageClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Storage is not configured");
  }

  storageClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return storageClient;
}