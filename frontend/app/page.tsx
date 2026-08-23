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

  const [backendOnline, setBackendOnline] = useState(false);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summaryLength, setSummaryLength] = useState<"Short" | "Medium" | "Long">("Medium");
  const [outputLang, setOutputLang] = useState("English");
  const [summaryText, setSummaryText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // TTS States
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [copied, setCopied] = useState(false);

  // Health check
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

  // Clean Markdown syntax before passing text to Speech Synthesis
  const cleanMarkdownForSpeech = (markdown: string): string => {
    return markdown
      .replace(/#{1,6}\s+/g, "")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/`{1,3}[^`]*`{1,3}/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/>\s+/g, "")
      .replace(/---+/g, "")
      .replace(/\n+/g, ". ")
      .trim();
  };

  const handleToggleSpeech = () => {
    if (!summaryText) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    const synth = window.speechSynthesis;

    if (isSpeaking && !isPaused) {
      synth.pause();
      setIsPaused(true);
      return;
    }

    if (isSpeaking && isPaused) {
      synth.resume();
      setIsPaused(false);
      return;
    }

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
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      alert(`Upload Error: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const generateSummary = async (docId: string, length: string, lang: string) => {
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
      const message = err instanceof Error ? err.message : "Error generating summary.";
      setSummaryText(`[Error generating summary: ${message}]`);
    } finally {
      setIsSummarizing(false);
    }
  };

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
      const message = err instanceof Error ? err.message : "Error generating answer.";
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
    <div className="min-h-screen bg-[#0d0f11] text-neutral-100 font-sans antialiased p-6 md:p-10">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#9df000] text-neutral-950 flex items-center justify-center font-bold text-lg shadow-sm">
            D
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">DocuIQ</h1>
            <p className="text-[11px] text-neutral-400">Next-Gen Intelligence Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? "bg-[#9df000] shadow-[0_0_8px_#9df000]" : "bg-red-500"
            }`}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
            {backendOnline ? "SYSTEM READY" : "CONNECTING..."}
          </span>
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* ROW 1: Document Management (Left) + AI Intelligence Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Document Management */}
          <section className="lg:col-span-4">
            <div className="bg-[#14171a] border border-[#23272c] rounded-2xl p-6 shadow-xl flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    DOCUMENT MANAGEMENT
                  </h2>
                  {doc && (
                    <button
                      onClick={() => {
                        handleStopSpeech();
                        setDoc(null);
                        setSummaryText("");
                        setMessages([]);
                      }}
                      className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      Clear Session
                    </button>
                  )}
                </div>

                {/* Upload Box */}
                <label className="border border-dashed border-neutral-700 hover:border-[#9df000]/60 transition-all rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-[#0e1012] hover:bg-[#9df000]/5 group">
                  <Upload className="w-7 h-7 text-neutral-400 group-hover:text-[#9df000] transition-colors mb-3" />
                  <span className="text-xs font-semibold text-neutral-200">
                    {isUploading ? "Processing Document..." : "Upload New Documents"}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-1">PDFs, Images, Scans</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>

                {/* Output Language */}
                <div className="mt-6 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Output Language:</span>
                  <select
                    value={outputLang}
                    onChange={(e) => setOutputLang(e.target.value)}
                    className="bg-[#1c2024] border border-[#2d3238] text-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#9df000] text-xs"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>
              </div>

              {/* Uploaded File Context */}
              {doc && (
                <div className="mt-4 pt-4 border-t border-[#23272c]">
                  <div className="bg-[#0e1012] border border-[#23272c] rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-[#9df000] shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-medium text-neutral-200 truncate">{doc.filename}</p>
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
                      className="text-neutral-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => generateSummary(doc.id, summaryLength, outputLang)}
                    disabled={isSummarizing}
                    className="w-full mt-3 bg-[#9df000] hover:bg-[#8cd800] text-neutral-950 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSummarizing ? "animate-spin" : ""}`} />
                    Regenerate Summary
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: AI Intelligence Summary */}
          <section className="lg:col-span-8">
            <div className="bg-[#14171a] border border-[#23272c] rounded-2xl p-6 shadow-xl flex flex-col min-h-[380px] h-[380px]">
              <div className="flex items-center justify-between pb-4 border-b border-[#23272c]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#9df000]" />
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                    AI INTELLIGENCE SUMMARY
                  </h2>
                </div>

                {/* Length Selector Pills */}
                <div className="flex items-center bg-[#0e1012] border border-[#23272c] rounded-lg p-0.5">
                  {(["Short", "Medium", "Long"] as const).map((len) => (
                    <button
                      key={len}
                      onClick={() => {
                        setSummaryLength(len);
                        if (doc) generateSummary(doc.id, len, outputLang);
                      }}
                      className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                        summaryLength === len
                          ? "bg-[#9df000] text-neutral-950 font-bold"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Text Content Area */}
              <div className="flex-1 overflow-y-auto py-4 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
                {summaryText ? (
                  summaryText
                ) : (
                  <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                    Upload a document to extract structured intelligence.
                  </div>
                )}
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-3 border-t border-[#23272c] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadTextFile}
                    disabled={!summaryText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1c2024] hover:bg-[#252a30] text-neutral-300 transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> TXT
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleSpeech}
                    disabled={!summaryText}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${
                      isSpeaking && !isPaused
                        ? "bg-[#9df000]/20 border-[#9df000]/50 text-[#9df000]"
                        : isSpeaking && isPaused
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-[#1c2024] hover:bg-[#252a30] border-[#2d3238] text-neutral-300"
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

                  {isSpeaking && (
                    <button
                      onClick={handleStopSpeech}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop
                    </button>
                  )}

                  <button
                    onClick={copyToClipboard}
                    disabled={!summaryText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1c2024] hover:bg-[#252a30] text-neutral-300 transition-colors disabled:opacity-40"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#9df000]" /> Copied
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
          </section>
        </div>

        {/* ROW 2: Grounded Document Copilot (Full Width Spanning Below) */}
        <section className="w-full">
          <div className="bg-[#14171a] border border-[#23272c] rounded-2xl p-6 shadow-xl flex flex-col h-[340px]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#23272c]">
              <Bot className="w-4 h-4 text-[#9df000]" />
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                GROUNDED DOCUMENT COPILOT
              </h2>
            </div>

            {/* Chat Thread */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-neutral-500 text-xs">
                  Ask targeted questions strictly verified against your uploaded document.
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
                      <div className="w-6 h-6 rounded-full bg-[#9df000] text-neutral-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                        AI
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-2.5 leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[#1f2429] text-neutral-200"
                          : "bg-[#0e1012] border border-[#23272c] text-neutral-300"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendChat} className="pt-3 border-t border-[#23272c] flex gap-2">
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder={doc ? "Ask a question about this document..." : "Upload a file to chat"}
                disabled={!doc || isChatting}
                className="flex-1 bg-[#0e1012] border border-[#23272c] rounded-xl px-4 py-2 text-xs text-neutral-200 focus:outline-none focus:border-[#9df000] disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!doc || !inputQuestion.trim() || isChatting}
                className="bg-[#9df000] hover:bg-[#8cd800] text-neutral-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-40"
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