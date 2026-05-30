import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL exists:", !!supabaseUrl);
console.log("Supabase key exists:", !!supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!
);