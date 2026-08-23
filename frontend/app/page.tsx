"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  Volume2,
  Pause,
  Play,
  Square,
  Copy,
  Check,
  Download,
  Trash2,
  Send,
  Sparkles,
  Bot,
  RefreshCw,
} from "lucide-react";

interface DocumentMeta {
  id: string;
  filename: string;
  page_count: number;
  word_count: number;
  preview: string;
}

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

export default function DocuIQDashboard() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://docuiq-backend.onrender.com";

  // Application States
  const [backendOnline, setBackendOnline] = useState(false);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summaryLength, setSummaryLength] = useState<
    "Short" | "Medium" | "Long"
  >("Medium");
  const [outputLang, setOutputLang] = useState("English");
  const [summaryText, setSummaryText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Text to Speech States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  // Backend Health Ping
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await fetch(`${apiUrl}/health`);
        if (res.ok && isMounted) setBackendOnline(true);
      } catch {
        try {
          await fetch(`${apiUrl}/health`, { mode: "no-cors" });
          if (isMounted) setBackendOnline(true);
        } catch {
          if (isMounted) setBackendOnline(false);
        }
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  // Clean Markdown syntax for Speech Synthesis
  const cleanMarkdownForSpeech = (markdown: string): string => {
    return markdown
      .replace(/#{1,6}\s+/g, "") // Remove headers (#, ##, ###)
      .replace(/(\*\*|__)(.*?)\1/g, "$2") // Strip Bold
      .replace(/(\*|_)(.*?)\1/g, "$2") // Strip Italics
      .replace(/`{1,3}[^`]*`{1,3}/g, "") // Remove inline code
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Links to text
      .replace(/^\s*[-*+]\s+/gm, "") // Bullet points
      .replace(/^\s*\d+\.\s+/gm, "") // Numbered lists
      .replace(/>\s+/g, "") // Blockquotes
      .replace(/---+/g, "") // Horizontal lines
      .replace(/\n+/g, ". ") // Newlines become vocal pauses
      .trim();
  };

  // Text-To-Speech Handlers
  const handleToggleSpeech = () => {
    if (!summaryText) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    const synth = window.speechSynthesis;

    // Pause active speech
    if (isSpeaking && !isPaused) {
      synth.pause();
      setIsPaused(true);
      return;
    }

    // Resume paused speech
    if (isSpeaking && isPaused) {
      synth.resume();
      setIsPaused(false);
      return;
    }

    // Start clean speech
    synth.cancel();
    const plainText = cleanMarkdownForSpeech(summaryText);
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    synth.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
  };

  const handleStopSpeech = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Upload Document
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleStopSpeech();
    setIsUploading(true);

    const safeName = file.name.replace(/[^a-zA-Z0-9]/g, "_");
    const docId = `doc_${safeName}_${file.size}_${file.lastModified}`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_id", docId);

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data: DocumentMeta = await res.json();
      setDoc(data);
      setMessages([]);
      generateSummary(data.id, summaryLength, outputLang);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      alert(`Upload Error: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Generate / Stream Summary
  const generateSummary = async (
    docId: string,
    length: string,
    lang: string,
  ) => {
    handleStopSpeech();
    setIsSummarizing(true);
    setSummaryText("");

    try {
      const res = await fetch(`${apiUrl}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId, length, language: lang }),
      });

      if (!res.ok || !res.body) throw new Error("Summarization stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setSummaryText(accumulated);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error generating summary.";
      setSummaryText(`[Error generating summary: ${message}]`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // Chat Ingestion & Stream
  const handleSendChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuestion.trim() || !doc || isChatting) return;

    const userQ = inputQuestion.trim();
    setInputQuestion("");
    setMessages((prev) => [...prev, { sender: "user", text: userQ }]);
    setIsChatting(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: doc.id, question: userQ }),
      });

      if (!res.ok || !res.body) throw new Error("Chat stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botResponse = "";

      setMessages((prev) => [...prev, { sender: "bot", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        botResponse += decoder.decode(value, { stream: true });
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { sender: "bot", text: botResponse },
        ]);
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error generating answer.";
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: `Error: ${message}` },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTextFile = () => {
    const blob = new Blob([summaryText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc?.filename || "document"}_summary.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans antialiased p-4 md:p-8">
      {/* Top Navbar */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-6 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-lime-400 text-neutral-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-lime-500/10">
            D
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">DocuIQ</h1>
            <p className="text-xs text-neutral-400">
              Next-Gen Intelligence Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              backendOnline ? "bg-lime-400 animate-pulse" : "bg-red-500"
            }`}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {backendOnline ? "System Ready" : "Connecting..."}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Left Column: Upload & Document Manager */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Document Management
              </h2>
              {doc && (
                <button
                  onClick={() => {
                    handleStopSpeech();
                    setDoc(null);
                    setSummaryText("");
                    setMessages([]);
                  }}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                >
                  Clear Session
                </button>
              )}
            </div>

            {/* Upload Box */}
            <label className="border-2 border-dashed border-neutral-700 hover:border-lime-400/60 transition-all rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-neutral-950/40 hover:bg-lime-400/5 group">
              <Upload className="w-8 h-8 text-neutral-400 group-hover:text-lime-400 transition-colors mb-3" />
              <span className="text-sm font-semibold text-neutral-200">
                {isUploading
                  ? "Processing Document..."
                  : "Upload New Documents"}
              </span>
              <span className="text-xs text-neutral-500 mt-1">
                PDFs, Images, Scans
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/*"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>

            {/* Settings */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Output Language:</span>
                <select
                  value={outputLang}
                  onChange={(e) => setOutputLang(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lime-400"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
            </div>

            {/* Processed Context Card */}
            {doc && (
              <div className="mt-6 pt-6 border-t border-neutral-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                  Processed Context
                </h3>
                <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-6 h-6 text-lime-400 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-medium text-neutral-200 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-[10px] text-neutral-500">
                        {doc.page_count} pg • {doc.word_count} words
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleStopSpeech();
                      setDoc(null);
                    }}
                    className="text-neutral-500 hover:text-red-400 p-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() =>
                    generateSummary(doc.id, summaryLength, outputLang)
                  }
                  disabled={isSummarizing}
                  className="w-full mt-4 bg-lime-400 hover:bg-lime-300 text-neutral-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isSummarizing ? "animate-spin" : ""}`}
                  />
                  Regenerate Summary
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: AI Summary & Copilot Chat */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col h-[400px]">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-lime-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                  AI Intelligence Summary
                </h2>
              </div>

              {/* Length Selector */}
              <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-lg p-1">
                {(["Short", "Medium", "Long"] as const).map((len) => (
                  <button
                    key={len}
                    onClick={() => {
                      setSummaryLength(len);
                      if (doc) generateSummary(doc.id, len, outputLang);
                    }}
                    className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
                      summaryLength === len
                        ? "bg-lime-400 text-neutral-950"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Summary Viewport */}
            <div className="flex-1 overflow-y-auto py-4 text-sm text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
              {summaryText ? (
                summaryText
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-600 text-xs">
                  Upload a document to extract structured intelligence.
                </div>
              )}
            </div>

            {/* Action Bar & TTS Controls */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadTextFile}
                  disabled={!summaryText}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" /> TXT
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Speech Synthesis Play/Pause */}
                <button
                  onClick={handleToggleSpeech}
                  disabled={!summaryText}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    isSpeaking && !isPaused
                      ? "bg-lime-400/20 border-lime-400/50 text-lime-300"
                      : isSpeaking && isPaused
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300"
                  }`}
                >
                  {!isSpeaking ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" /> Listen
                    </>
                  ) : isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </>
                  )}
                </button>

                {/* Stop Speech Button */}
                {isSpeaking && (
                  <button
                    onClick={handleStopSpeech}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop
                  </button>
                )}

                {/* Copy Button */}
                <button
                  onClick={copyToClipboard}
                  disabled={!summaryText}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-lime-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Grounded Copilot Chat */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col h-[380px]">
            <div className="flex items-center gap-2 pb-4 border-b border-neutral-800">
              <Bot className="w-4 h-4 text-lime-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Grounded Document Copilot
              </h2>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-neutral-600 text-xs">
                  Ask targeted questions strictly verified against your uploaded
                  document.
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 text-xs ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.sender === "bot" && (
                      <div className="w-6 h-6 rounded-full bg-lime-400 text-neutral-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 leading-relaxed ${
                        m.sender === "user"
                          ? "bg-neutral-800 text-neutral-200"
                          : "bg-neutral-950 border border-neutral-800 text-neutral-300"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendChat}
              className="pt-3 border-t border-neutral-800 flex gap-2"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder={
                  doc
                    ? "Ask a question about this document..."
                    : "Upload a file to chat"
                }
                disabled={!doc || isChatting}
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-xs text-neutral-200 focus:outline-none focus:border-lime-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!doc || !inputQuestion.trim() || isChatting}
                className="bg-lime-400 hover:bg-lime-300 text-neutral-950 px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
