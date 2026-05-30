"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setReply("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();

    setReply(data.reply || data.error || "No response");
    setLoading(false);
  };

  return (
    <main className="p-10 max-w-3xl">
      <h1 className="text-4xl font-bold">
        Mining AI Platform
      </h1>

      <p className="mt-2">
        AI Chat Dashboard
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <textarea
          className="border p-3 min-h-32"
          placeholder="Ask something..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          className="border p-3"
          onClick={sendMessage}
          disabled={loading}
        >
          {loading ? "Thinking..." : "Send"}
        </button>

        {reply && (
          <div className="border p-4 whitespace-pre-wrap">
            <strong>AI:</strong>
            <div className="mt-2 prose">
              <ReactMarkdown>
                {reply}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}