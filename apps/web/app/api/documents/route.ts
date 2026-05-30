import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .trim();

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .trim();

const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey
);

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, title, file_name, file_path, mime_type, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ documents: data || [] });
}

export async function DELETE(req: Request) {
  const { id, filePath } = await req.json();

  if (!id || !filePath) {
    return Response.json(
      { error: "id and filePath are required" },
      { status: 400 }
    );
  }

  await supabaseAdmin.storage
    .from("documents")
    .remove([filePath]);

  const { error } = await supabaseAdmin
    .from("documents")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}