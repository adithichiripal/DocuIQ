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
  Mic,
  ShieldCheck,
  Zap,
  Globe,
} from "lucide-react";

interface DocumentMeta {
  id: string;
  filename: string;
  page_count: number;
  word_count: number;
  file_size?: string;
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
  const [summaryLength, setSummaryLength] = useState<
    "Short" | "Medium" | "Long"
  >("Short");
  const [outputLang, setOutputLang] = useState("English");
  const [summaryText, setSummaryText] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // TTS States
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
    const fileSizeStr = `${(file.size / 1024).toFixed(1)} KB`;
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
      data.file_size = fileSizeStr;
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

  // Safe typed Voice Input
  const handleVoiceInput = () => {
    if (typeof window === "undefined") return;

    const win = window as unknown as Record<string, unknown>;
    const SpeechConstructor = (win.SpeechRecognition ||
      win.webkitSpeechRecognition) as
      | {
          new (): {
            lang: string;
            interimResults: boolean;
            onstart: (() => void) | null;
            onend: (() => void) | null;
            onerror: (() => void) | null;
            onresult:
              | ((event: { results: { transcript: string }[][] }) => void)
              | null;
            start: () => void;
          };
        }
      | undefined;

    if (!SpeechConstructor) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechConstructor();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListeningVoice(true);
    recognition.onend = () => setIsListeningVoice(false);
    recognition.onerror = () => setIsListeningVoice(false);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInputQuestion(transcript);
      }
    };

    recognition.start();
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
    <div className="min-h-screen bg-[#060809] text-neutral-100 font-sans antialiased p-6 md:p-10 selection:bg-[#72e811] selection:text-neutral-950">
      {/* Top Navbar */}
      <header className="max-w-7xl mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#72e811] text-neutral-950 flex items-center justify-center font-black text-base shadow-[0_0_12px_rgba(114,232,17,0.4)]">
            <Zap className="w-4 h-4 fill-neutral-950 text-neutral-950" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-white uppercase">
            Docu<span className="text-[#72e811]">IQ</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d1013] border border-[#1a2026] text-neutral-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#72e811]" />
            <span>30-Day Encrypted Retention</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#0d1013] border border-[#1a2026]">
            <span
              className={`w-2 h-2 rounded-full ${
                backendOnline
                  ? "bg-[#72e811] shadow-[0_0_8px_#72e811]"
                  : "bg-red-500"
              }`}
            />
            <span className="text-xs font-semibold text-[#72e811]">
              {backendOnline ? "System Ready" : "Connecting..."}
            </span>
          </div>
        </div>
      </header>

      {/* Hero Header Badge & Title */}
      <div className="max-w-4xl mx-auto text-center my-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111612] border border-[#1b2b16] text-[#72e811] text-xs font-semibold mb-4">
          <Zap className="w-3 h-3 fill-current" />
          <span>SQLite Persistent & Streaming AI</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
          AI Document Summarizer & Voice Copilot
        </h2>
        <p className="text-xs md:text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Multi-document extraction with persistent sessions, OCR badges, and
          instant voice interaction.
        </p>
      </div>

      {/* Main Grid Layout */}
      <main className="max-w-7xl mx-auto space-y-6">
        {/* ROW 1: Document Management (Left) + AI Intelligence Summary (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Document Management */}
          <section className="lg:col-span-5">
            <div className="bg-[#0b0e11] border border-[#161c22] rounded-2xl p-6 shadow-2xl flex flex-col justify-between min-h-[460px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                    DOCUMENT MANAGEMENT
                  </h3>
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
                <label className="border border-dashed border-[#202832] hover:border-[#72e811]/60 transition-all rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer bg-[#07090b] hover:bg-[#72e811]/5 group">
                  <div className="w-10 h-10 rounded-full bg-[#10151a] flex items-center justify-center mb-3 group-hover:bg-[#72e811]/10 transition-colors">
                    <Upload className="w-5 h-5 text-neutral-400 group-hover:text-[#72e811] transition-colors" />
                  </div>
                  <span className="text-sm font-semibold text-neutral-200">
                    {isUploading
                      ? "Processing Document..."
                      : "Upload New Documents"}
                  </span>
                  <span className="text-xs text-neutral-500 mt-1">
                    PDFs, Scans, Receipts, Images
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>

                {/* Output Language Selector */}
                <div className="mt-6 flex items-center justify-between bg-[#07090b] border border-[#161c22] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-neutral-400 text-xs">
                    <Globe className="w-4 h-4 text-neutral-400" />
                    <span>Output Language:</span>
                  </div>
                  <select
                    value={outputLang}
                    onChange={(e) => setOutputLang(e.target.value)}
                    className="bg-[#12161b] border border-[#202832] text-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#72e811] text-xs font-medium"
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Hindi">Hindi</option>
                  </select>
                </div>
              </div>

              {/* Uploaded Document Context */}
              {doc && (
                <div className="mt-6 pt-4 border-t border-[#161c22]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
                    PROCESSED CONTEXT (1)
                  </p>
                  <div className="bg-[#07090b] border border-[#161c22] rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-5 h-5 text-[#72e811] shrink-0" />
                      <div className="truncate">
                        <p className="text-xs font-semibold text-neutral-200 truncate">
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-[#172b12] border border-[#23421b] text-[#72e811] font-bold px-2 py-0.5 rounded">
                            PyMuPDF / OCR
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {doc.page_count} pg • {doc.word_count} words •{" "}
                            {doc.file_size || "48 KB"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleStopSpeech();
                        setDoc(null);
                      }}
                      className="text-neutral-500 hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Regenerate Summary Green Button */}
                  <button
                    onClick={() =>
                      generateSummary(doc.id, summaryLength, outputLang)
                    }
                    disabled={isSummarizing}
                    className="w-full mt-4 bg-[#72e811] hover:bg-[#64cf0d] text-neutral-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(114,232,17,0.2)] disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isSummarizing ? "animate-spin" : ""}`}
                    />
                    Regenerate Summary
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Right Column: AI Intelligence Summary */}
          <section className="lg:col-span-7">
            <div className="bg-[#0b0e11] border border-[#161c22] rounded-2xl p-6 shadow-2xl flex flex-col justify-between min-h-[460px] h-[460px]">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-[#161c22]">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#72e811]" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
                      AI INTELLIGENCE SUMMARY
                    </h3>
                  </div>

                  {/* Length Selector Pills */}
                  <div className="flex items-center bg-[#07090b] border border-[#161c22] rounded-lg p-0.5">
                    {(["Short", "Medium", "Long"] as const).map((len) => (
                      <button
                        key={len}
                        onClick={() => {
                          setSummaryLength(len);
                          if (doc) generateSummary(doc.id, len, outputLang);
                        }}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                          summaryLength === len
                            ? "bg-[#72e811] text-neutral-950 shadow-sm"
                            : "text-neutral-400 hover:text-neutral-200"
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary Body */}
                <div className="overflow-y-auto max-h-[300px] py-4 text-xs text-neutral-300 leading-relaxed font-sans whitespace-pre-wrap">
                  {summaryText ? (
                    summaryText
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-neutral-500 text-xs">
                      Upload a document to extract structured intelligence.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="pt-4 border-t border-[#161c22] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadTextFile}
                    disabled={!summaryText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#12161b] hover:bg-[#1a2026] text-neutral-300 border border-[#202832] transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                  <button
                    onClick={downloadTextFile}
                    disabled={!summaryText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#12161b] hover:bg-[#1a2026] text-neutral-300 border border-[#202832] transition-colors disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> TXT
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Clean Text-to-Speech Play/Pause Controls */}
                  <button
                    onClick={handleToggleSpeech}
                    disabled={!summaryText}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${
                      isSpeaking && !isPaused
                        ? "bg-[#72e811]/20 border-[#72e811]/50 text-[#72e811]"
                        : isSpeaking && isPaused
                          ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                          : "bg-[#12161b] hover:bg-[#1a2026] border-[#202832] text-neutral-300"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop
                    </button>
                  )}

                  <button
                    onClick={copyToClipboard}
                    disabled={!summaryText}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#12161b] hover:bg-[#1a2026] border border-[#202832] text-neutral-300 transition-colors disabled:opacity-40"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#72e811]" /> Copied
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

        {/* ROW 2: Voice & Text Copilot (Full Width Spanning Below) */}
        <section className="w-full">
          <div className="bg-[#0b0e11] border border-[#161c22] rounded-2xl p-6 shadow-2xl flex flex-col min-h-[260px] justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#161c22]">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[#72e811]" />
                  <h3 className="text-sm font-bold text-neutral-200">
                    Voice & Text Copilot
                  </h3>
                </div>
                <span className="text-[11px] font-semibold bg-[#12161b] border border-[#202832] text-neutral-400 px-3 py-1 rounded-full">
                  Grounded Q&A
                </span>
              </div>

              {/* Chat Thread */}
              <div className="overflow-y-auto max-h-[140px] py-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-[80px] flex flex-col items-center justify-center text-neutral-500 text-xs gap-1">
                    <Sparkles className="w-4 h-4 text-amber-300/80 mb-1" />
                    <span>
                      Upload a document and ask questions about its contents.
                    </span>
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
                        <div className="w-6 h-6 rounded-full bg-[#72e811] text-neutral-950 flex items-center justify-center font-bold text-[10px] shrink-0">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 leading-relaxed ${
                          m.sender === "user"
                            ? "bg-[#182028] text-neutral-200"
                            : "bg-[#07090b] border border-[#161c22] text-neutral-300"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input Bar with Mic Icon & Send Button */}
            <form
              onSubmit={handleSendChat}
              className="pt-3 border-t border-[#161c22] flex items-center gap-2"
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListeningVoice
                    ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
                    : "bg-[#07090b] border-[#202832] text-neutral-400 hover:text-[#72e811] hover:border-[#72e811]/40"
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Ask a question about your documents..."
                disabled={!doc || isChatting}
                className="flex-1 bg-[#07090b] border border-[#202832] rounded-xl px-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-[#72e811] disabled:opacity-40 placeholder:text-neutral-600"
              />
              <button
                type="submit"
                disabled={!doc || !inputQuestion.trim() || isChatting}
                className="bg-[#72e811] hover:bg-[#64cf0d] text-neutral-950 p-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all disabled:opacity-40 shadow-[0_0_12px_rgba(114,232,17,0.3)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
