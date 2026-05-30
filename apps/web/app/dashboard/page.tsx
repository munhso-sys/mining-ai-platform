"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { supabase } from "../../lib/supabase";

import "katex/dist/katex.min.css";

type ChatSession = {
  id: string;
  title: string;
  created_at: string;
};

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    setSessions(data || []);
  };

  const loadMessages = async (sessionId: string) => {
    setCurrentSessionId(sessionId);

    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    setMessages(data || []);
  };

  const newChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setMessage("");
  };

  const deleteChat = async (sessionId: string) => {
    const ok = confirm("Delete this chat?");
    if (!ok) return;

    await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId);

    if (currentSessionId === sessionId) {
      newChat();
    }

    await loadSessions();
  };

  const sendMessage = async () => {
    if (!message.trim() || loading) return;

    const userMessage = message;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
    ]);

    setMessage("");
    setLoading(true);

    const res = await fetch("/api/chat-stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: currentSessionId,
      }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();

    let assistantReply = "";

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
      },
    ]);

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        assistantReply += chunk;

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: assistantReply,
          };
          return next;
        });
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <main className="flex min-h-screen bg-gray-50">
      <aside className="w-72 border-r bg-white p-4">
        <h2 className="text-xl font-bold">Chats</h2>

        <button
          className="mt-4 w-full rounded border p-2 hover:bg-gray-100"
          onClick={newChat}
        >
          + New Chat
        </button>

        <div className="mt-4 flex flex-col gap-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center gap-2 rounded border p-2 ${
                currentSessionId === session.id ? "bg-gray-100" : "bg-white"
              }`}
            >
              <button
                className="flex-1 truncate text-left"
                onClick={() => loadMessages(session.id)}
              >
                {session.title || "New Chat"}
              </button>

              <button
                className="text-red-600 hover:text-red-800"
                onClick={() => deleteChat(session.id)}
                title="Delete chat"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex flex-1 flex-col p-8">
        <div>
          <h1 className="text-4xl font-bold">Mining AI Platform</h1>
          <p className="mt-2">AI Chat Dashboard</p>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto rounded border bg-white p-6">
          {messages.length === 0 && (
            <p className="text-gray-500">
              Start a new conversation about mining, finance, NPV, IRR, WACC, or project analysis.
            </p>
          )}

          {messages.map((m, index) => (
            <div
              key={index}
              className={`mb-5 flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-black"
                }`}
              >
                <div className="mb-1 text-sm font-bold">
                  {m.role === "user" ? "You" : "AI"}
                </div>

                <div className="prose max-w-none whitespace-pre-wrap">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="mb-5 flex justify-start">
              <div className="rounded-2xl bg-gray-100 px-4 py-3">
                AI is thinking...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <textarea
            className="min-h-28 rounded border bg-white p-3"
            placeholder="Ask something..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />

          <button
            className="rounded border bg-black p-3 text-white disabled:bg-gray-400"
            onClick={sendMessage}
            disabled={loading}
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
      </section>
    </main>
  );
}