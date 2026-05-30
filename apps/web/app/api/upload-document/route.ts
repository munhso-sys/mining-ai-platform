import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

function chunkText(text: string, maxLength = 1200) {
  const cleanText = text
    .replace(/\s+/g, " ")
    .trim();

  const chunks: string[] = [];

  for (let i = 0; i < cleanText.length; i += maxLength) {
    chunks.push(cleanText.slice(i, i + maxLength));
  }

  return chunks.filter((chunk) => chunk.length > 100);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return Response.json(
        { error: "Only PDF files are supported for now" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const safeFileName = file.name
      .normalize("NFKD")
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    const filePath = `${Date.now()}-${safeFileName || "document.pdf"}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const parsed = await pdfParse(fileBuffer);
    const text = parsed.text;

    if (!text || text.trim().length < 50) {
      return Response.json(
        { error: "Could not extract enough text from PDF" },
        { status: 400 }
      );
    }

    const { data: document, error: docError } = await supabaseAdmin
      .from("documents")
      .insert({
        title: file.name,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type,
      })
      .select()
      .single();

    if (docError) {
      throw docError;
    }

    const chunks = chunkText(text);

    for (const chunk of chunks) {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunk,
      });

      const embedding = embeddingResponse.data[0].embedding;

      const { error: chunkError } = await supabaseAdmin
        .from("document_chunks")
        .insert({
          document_id: document.id,
          content: chunk,
          embedding,
        });

      if (chunkError) {
        throw chunkError;
      }
    }

    return Response.json({
      success: true,
      documentId: document.id,
      fileName: file.name,
      chunks: chunks.length,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to upload and process document",
      },
      { status: 500 }
    );
  }
}