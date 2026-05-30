import OpenAI from "openai";
import { supabase } from "../../../lib/supabase";
type RagSource = {
  label: string;
  title: string;
  fileName: string;
  similarity: number;
  content: string;
};
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message, sessionId, documentIds } = await req.json();

  if (!message) {
    return new Response("Message is required", { status: 400 });
  }

  let activeSessionId = sessionId;

  if (!activeSessionId) {
    const titleResponse = await client.responses.create({
      model: "gpt-5.5",
      input: [
        {
          role: "system",
          content:
            "Create a short chat title in Mongolian. Maximum 5 words. No quotes. No punctuation.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const generatedTitle =
      titleResponse.output_text?.trim() || message.slice(0, 40);

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        title: generatedTitle,
      })
      .select()
      .single();

    if (error) {
      return new Response(error.message, { status: 500 });
    }

    activeSessionId = session.id;
  }

  await supabase.from("chat_messages").insert({
    session_id: activeSessionId,
    role: "user",
    content: message,
  });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", activeSessionId)
    .order("created_at", { ascending: true });

  const embeddingResponse = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: message,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const selectedDocumentIds =
    Array.isArray(documentIds) && documentIds.length > 0
      ? documentIds
      : null;

  const { data: matches } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: 5,
    filter_document_ids: selectedDocumentIds,
  });

  const sources: RagSource[] =
    matches?.map(
      (
        m: {
          content: string;
          similarity: number;
          document_title: string;
          file_name: string;
        },
        index: number
      ) => ({
        label: `Source ${index + 1}`,
        title: m.document_title || m.file_name,
        fileName: m.file_name,
        similarity: m.similarity,
        content: m.content,
      })
    ) || [];

  const context =
    sources
      .map(
        (s) => `
  ${s.label}
  Document: ${s.title}
  File: ${s.fileName}
  Similarity: ${s.similarity}

  ${s.content}
  `
      )
      .join("\n\n---\n\n");

  const stream = await client.responses.create({
    model: "gpt-5.5",
    stream: true,
    input: [
      {
        role: "system",
        content: `
You are Mining AI Platform.

Rules:
1. Reply in Mongolian unless requested otherwise.
2. Use Markdown formatting.
3. All mathematical formulas must use LaTeX.
4. Inline formulas use $...$
5. Display formulas use $$...$$.
6. Never output raw \\sum, \\frac, \\sqrt outside LaTeX delimiters.
7. When explaining mining economics concepts, include formulas in display mode.
8. If document context is provided, answer primarily from that context.
9. If the context does not contain the answer, say that the uploaded documents do not contain enough information.
10. When using document context, cite the source documents.
11. At the end of the answer include:

Эх сурвалж:
- Document Name 1
- Document Name 2

12. Never invent sources that are not present in the provided context.
Document context:

${context}
        `,
      },
      ...(history || []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ],
  });

  const encoder = new TextEncoder();
  let assistantReply = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            assistantReply += event.delta;
            controller.enqueue(encoder.encode(event.delta));
          }
        }

        await supabase.from("chat_messages").insert({
          session_id: activeSessionId,
          role: "assistant",
          content: assistantReply,
        });

        controller.close();
      } catch (error) {
        console.error(error);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Session-Id": activeSessionId,
    },
  });
}