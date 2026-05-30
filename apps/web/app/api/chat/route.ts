import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return Response.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

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
5. Display formulas use $$...$$
6. Never output raw \\sum, \\frac, \\sqrt outside LaTeX delimiters.
7. When explaining mining economics concepts (NPV, IRR, WACC), include formulas in display mode.

Example:

$$
NPV = \\sum_{t=1}^{n}\\frac{CF_t}{(1+r)^t} - C_0
$$
`
    },
    {
      role: "user",
      content: message
    }
  ]
});

    return Response.json({
      reply: response.output_text,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}