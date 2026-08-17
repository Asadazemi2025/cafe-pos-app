import "server-only";
import { createClient } from "@supabase/supabase-js";

// service_role키はRLSを無視するサーバー専用クライアント。ブラウザには渡らない。
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
