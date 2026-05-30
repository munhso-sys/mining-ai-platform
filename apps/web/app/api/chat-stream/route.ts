import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  const { message } = await req.json();

  const stream = await client.responses.create({
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
        `,
      },
      {
        role: "user",
        content: message,
      },
    ],
    stream: true,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            controller.enqueue(
              encoder.encode(event.delta)
            );
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}