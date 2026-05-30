import OpenAI from "openai";
import { supabase } from "../../../lib/supabase";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, sessionId } = await req.json();

    if (!message) {
      return Response.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const { data: session, error } = await supabase
        .from("chat_sessions")
        .insert({
          title: message.slice(0, 40),
        })
        .select()
        .single();

      if (error) throw error;

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

    const response = await client.responses.create({
      model: "gpt-5.5",
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
          `,
        },
        ...(history || []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
    });

    const reply = response.output_text;

    await supabase.from("chat_messages").insert({
      session_id: activeSessionId,
      role: "assistant",
      content: reply,
    });

    return Response.json({
      reply,
      sessionId: activeSessionId,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}