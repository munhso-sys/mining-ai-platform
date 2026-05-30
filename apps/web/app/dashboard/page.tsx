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
type DocumentItem = {
  id: string;
  title: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  created_at: string;
};
export default function Dashboard() {
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
    loadSessions();
    loadDocuments();
  }, [messages, loading]);

  const loadSessions = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    setSessions(data || []);
  };
const loadDocuments = async () => {
  const res = await fetch("/api/documents");
  const data = await res.json();

  setDocuments(data.documents || []);
};

const deleteDocument = async (doc: DocumentItem) => {
  const ok = confirm(`Delete document: ${doc.file_name}?`);
  if (!ok) return;

  const res = await fetch("/api/documents", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: doc.id,
      filePath: doc.file_path,
    }),
  });

  const data = await res.json();

  if (data.error) {
    alert(data.error);
    return;
  }

  await loadDocuments();
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

    await supabase.from("chat_sessions").delete().eq("id", sessionId);

    if (currentSessionId === sessionId) {
      newChat();
    }

    await loadSessions();
  };

  const uploadPdf = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(
      "/api/upload-document",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await res.json();

    if (data.error) {
      alert(data.error);
    } else {
      alert(
        `Uploaded successfully.\nChunks: ${data.chunks}`
      );
      await loadDocuments();
    }

    setUploading(false);
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

    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Алдаа гарлаа. Дахин оролдоно уу.",
        },
      ]);
      setLoading(false);
      return;
    }

    const newSessionId = res.headers.get("X-Session-Id");

    if (newSessionId && !currentSessionId) {
      setCurrentSessionId(newSessionId);
    }
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
    await loadSessions();
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <aside className="hidden w-72 shrink-0 border-r bg-white p-4 md:block">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Chats</h2>
        </div>

        <button
          className="mt-4 w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
          onClick={newChat}
        >
          + New Chat
        </button>

        <div className="mt-4 flex flex-col gap-2 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                currentSessionId === session.id
                  ? "bg-slate-100"
                  : "bg-white hover:bg-slate-50"
              }`}
            >
              <button
                className="flex-1 truncate text-left"
                onClick={() => loadMessages(session.id)}
              >
                {session.title || "New Chat"}
              </button>

              <button
                className="text-red-500 hover:text-red-700"
                onClick={() => deleteChat(session.id)}
                title="Delete chat"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t pt-4">
          <h2 className="text-xl font-bold">Documents</h2>

          <div className="mt-3 flex flex-col gap-2">
            {documents.length === 0 && (
              <p className="text-sm text-slate-500">
                No documents uploaded.
              </p>
            )}

            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate">
                  📄 {doc.file_name}
                </span>

                <button
                  className="text-red-500 hover:text-red-700"
                  onClick={() => deleteDocument(doc)}
                  title="Delete document"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="flex h-screen min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b bg-white px-6 py-4">
          <h1 className="text-2xl font-bold">Mining AI Platform</h1>
          <p className="text-sm text-slate-500">AI Chat Dashboard</p>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
            {messages.length === 0 && (
              <div className="rounded-2xl border bg-white p-6 text-slate-500">
                Start a new conversation about mining, finance, NPV, IRR, WACC, project analysis, or feasibility studies.
              </div>
            )}

            {messages.map((m, index) => (
              <div
                key={index}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                    m.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-900"
                  }`}
                >
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide opacity-70">
                    {m.role === "user" ? "You" : "AI"}
                  </div>

                  <div className="prose max-w-none whitespace-pre-wrap prose-p:my-2 prose-ul:my-2 prose-ol:my-2">
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
              <div className="flex justify-start">
                <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                  AI is thinking...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        <div className="shrink-0 border-t bg-white px-4 py-4 md:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer rounded-xl border px-4 py-2 hover:bg-slate-100">
                {uploading
                  ? "Uploading..."
                  : "📄 Upload PDF"}

                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={uploadPdf}
                />
              </label>
            </div>
            <textarea
              className="min-h-24 w-full resize-none rounded-2xl border bg-white p-4 outline-none focus:ring-2 focus:ring-slate-300"
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

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Enter to send · Shift+Enter for new line
              </p>

              <button
                className="rounded-xl bg-slate-900 px-6 py-2 text-white disabled:bg-slate-400"
                onClick={sendMessage}
                disabled={loading}
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}