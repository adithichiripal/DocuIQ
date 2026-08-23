"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Volume2,
  Copy,
  Download,
  Send,
  Mic,
  MicOff,
  ShieldCheck,
  Bot,
} from "lucide-react";

interface ProcessedFile {
  id: string;
  name: string;
  engine: string;
  pages: number;
  words: number;
  size: string;
}

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

export default function DocuIQApp() {
  const [docId] = useState<string>(
    () => "doc_" + Math.random().toString(36).substring(2, 9),
  );
  const [uploading, setUploading] = useState(false);
  const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(
    null,
  );

  // Summary State
  const [granularity, setGranularity] = useState<"Short" | "Medium" | "Long">(
    "Medium",
  );
  const [language, setLanguage] = useState("English");
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [answering, setAnswering] = useState(false);
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Backend Health
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://docuiq-backend.onrender.com";

  // Check Backend Status on mount
  useEffect(() => {
    let isMounted = true;
    const checkHealth = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(`${apiUrl}/health`);
          if (res.ok && isMounted) {
            setBackendOnline(true);
            return;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (isMounted) setBackendOnline(false);
    };
    checkHealth();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    setSummary("");
    setMessages([]);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("doc_id", docId);

    const fileSizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`;

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      setProcessedFile({
        id: docId,
        name: data.filename,
        engine: data.filename.toLowerCase().endsWith(".pdf")
          ? "PyMuPDF / OCR"
          : "Tesseract OCR",
        pages: data.page_count || 1,
        words: data.word_count || 0,
        size: fileSizeStr,
      });

      triggerSummary(docId, granularity, language);
    } catch (err) {
      console.error(err);
      alert("Failed to process document. Please check the backend connection.");
    } finally {
      setUploading(false);
    }
  };

  // Trigger Summary Stream
  const triggerSummary = async (
    targetDocId: string,
    targetGranularity: string,
    targetLang: string,
  ) => {
    setSummarizing(true);
    setSummary("");

    try {
      const res = await fetch(`${apiUrl}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: targetDocId,
          length: targetGranularity,
          language: targetLang,
        }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        setSummary((prev) => prev + chunk);
      }
    } catch (err) {
      console.error(err);
      setSummary("Error generating summary.");
    } finally {
      setSummarizing(false);
    }
  };

  // Copilot Message Stream
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim() || !processedFile) return;

    setMessages((prev) => [...prev, { sender: "user", text: queryText }]);
    setChatInput("");
    setAnswering(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId, question: queryText }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiText = "";

      setMessages((prev) => [...prev, { sender: "ai", text: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        aiText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: "ai", text: aiText };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnswering(false);
    }
  };

  // Web Speech Recognition
  const toggleListening = () => {
    const windowWithSpeech = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: (e: {
          results: { 0: { 0: { transcript: string } } };
        }) => void;
        onerror: () => void;
        onend: () => void;
      };
      SpeechRecognition?: new () => {
        lang: string;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: (e: {
          results: { 0: { 0: { transcript: string } } };
        }) => void;
        onerror: () => void;
        onend: () => void;
      };
    };

    const SpeechClass =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;
    if (!SpeechClass) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechClass();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    if (!listening) {
      recognition.start();
      setListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        handleSendMessage(transcript);
        setListening(false);
      };
      recognition.onerror = () => setListening(false);
      recognition.onend = () => setListening(false);
    } else {
      recognition.stop();
      setListening(false);
    }
  };

  // Text-to-Speech
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // Export TXT
  const downloadTXT = () => {
    if (!summary) return;
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `DocuIQ_Summary_${docId}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#06080c] text-white font-sans selection:bg-lime-500/30">
      {/* Top Navbar */}
      <header className="border-b border-[#131926] bg-[#090d14]/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400">
            <Zap className="h-4 w-4 fill-lime-400" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white">
            DOCU<span className="text-lime-400">IQ</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#111722] border border-[#1e293b] text-gray-300">
            <ShieldCheck className="h-3.5 w-3.5 text-lime-400" />
            <span>30-Day Encrypted Retention</span>
          </div>

          <div>
            {backendOnline === true ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#0e2a18] text-lime-400 border border-lime-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-400 animate-pulse"></span>
                System Ready
              </span>
            ) : backendOnline === false ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-950/70 text-red-400 border border-red-800/60">
                <AlertCircle className="h-3.5 w-3.5" />
                Backend Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#1a1f2c] text-gray-400 border border-gray-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-lime-400" />
                Connecting...
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Title & Badge */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#111722] border border-[#1e293b] text-lime-400">
            <Zap className="h-3.5 w-3.5 fill-lime-400" />
            <span>SQLite Persistent & Streaming AI</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            AI Document Summarizer & Voice Copilot
          </h1>
          <p className="text-sm text-gray-400 max-w-xl mx-auto">
            Multi-document extraction with persistent sessions, OCR badges, and
            instant voice interaction.
          </p>
        </div>

        {/* Top Two Columns: Document Management & AI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card: Document Management */}
          <div className="bg-[#0b0f17] border border-[#151d2a] rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                  Document Management
                </h2>
                <button
                  onClick={() => {
                    setProcessedFile(null);
                    setSummary("");
                    setMessages([]);
                  }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition"
                >
                  Clear Session
                </button>
              </div>

              {/* Upload Dropzone */}
              <div className="relative group border border-dashed border-[#222f44] hover:border-lime-500/50 rounded-xl p-8 bg-[#080c14] text-center transition-all">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-[#121927] flex items-center justify-center text-lime-400 group-hover:scale-105 transition-transform">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-5 w-5" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {uploading
                      ? "Extracting & Processing..."
                      : "Upload New Documents"}
                  </p>
                  <p className="text-xs text-gray-500">
                    PDFs, Scans, Receipts, Images
                  </p>
                </div>
              </div>

              {/* Output Language Selector */}
              <div className="flex items-center justify-between bg-[#080c14] border border-[#17202f] rounded-xl px-4 py-2.5">
                <span className="text-xs text-gray-300 flex items-center gap-2">
                  <span className="text-lime-400 font-bold">🌐</span> Output
                  Language:
                </span>
                <select
                  value={language}
                  onChange={(e) => {
                    setLanguage(e.target.value);
                    if (processedFile)
                      triggerSummary(docId, granularity, e.target.value);
                  }}
                  className="bg-[#111722] border border-[#1e293b] text-xs text-gray-200 rounded-lg px-2.5 py-1.5 focus:border-lime-500 outline-none"
                >
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>

              {/* Processed Context Section */}
              {processedFile && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Processed Context (1)
                  </h3>
                  <div className="bg-[#080c14] border border-[#17202f] rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-start gap-2.5 overflow-hidden">
                      <FileText className="h-4 w-4 text-lime-400 shrink-0 mt-0.5" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-medium text-gray-200 truncate">
                          {processedFile.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-[#132819] text-lime-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-lime-500/30">
                            {processedFile.engine}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {processedFile.pages} pg • {processedFile.words}{" "}
                            words • {processedFile.size}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setProcessedFile(null)}
                      className="text-gray-500 hover:text-red-400 p-1 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Lime Regenerate Button */}
            <button
              onClick={() =>
                processedFile && triggerSummary(docId, granularity, language)
              }
              disabled={!processedFile || summarizing}
              className="w-full bg-[#84cc16] hover:bg-[#65a30d] disabled:opacity-40 disabled:hover:bg-[#84cc16] text-black font-semibold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-lime-950/40"
            >
              <CheckCircle className="h-4 w-4" />
              {summarizing ? "Generating Summary..." : "Regenerate Summary"}
            </button>
          </div>

          {/* Right Card: AI Intelligence Summary */}
          <div className="bg-[#0b0f17] border border-[#151d2a] rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                  AI Intelligence Summary
                </h2>

                {/* Granularity Pills */}
                <div className="flex bg-[#080c14] p-1 rounded-lg border border-[#17202f]">
                  {(["Short", "Medium", "Long"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => {
                        setGranularity(lvl);
                        if (processedFile) triggerSummary(docId, lvl, language);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                        granularity === lvl
                          ? "bg-[#84cc16] text-black shadow-sm"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Content Body */}
              <div className="bg-[#080c14] border border-[#17202f] rounded-xl p-4 min-h-[260px] max-h-[300px] overflow-y-auto text-xs text-gray-300 leading-relaxed font-sans">
                {summarizing && !summary && (
                  <div className="flex items-center gap-2 text-gray-500 pt-6">
                    <Loader2 className="h-4 w-4 animate-spin text-lime-400" />
                    Synthesizing tokens from extracted context...
                  </div>
                )}
                {summary ? (
                  <div className="whitespace-pre-wrap">{summary}</div>
                ) : (
                  !summarizing && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-600">
                      <p>
                        Upload a document and select granularity to generate
                        summary.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Action Bar (PDF, TXT, Listen, Copy) */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex gap-2">
                <button
                  onClick={downloadTXT}
                  disabled={!summary}
                  className="bg-[#111722] hover:bg-[#162030] disabled:opacity-40 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-[#1e293b] flex items-center gap-1.5 transition"
                >
                  <Download className="h-3 w-3 text-red-400" /> PDF
                </button>
                <button
                  onClick={downloadTXT}
                  disabled={!summary}
                  className="bg-[#111722] hover:bg-[#162030] disabled:opacity-40 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-[#1e293b] flex items-center gap-1.5 transition"
                >
                  <Download className="h-3 w-3 text-blue-400" /> TXT
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => speakText(summary)}
                  disabled={!summary}
                  className="bg-[#111722] hover:bg-[#162030] disabled:opacity-40 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-[#1e293b] flex items-center gap-1.5 transition"
                >
                  <Volume2 className="h-3 w-3 text-lime-400" /> Listen
                </button>
                <button
                  onClick={() => {
                    if (summary) {
                      navigator.clipboard.writeText(summary);
                      alert("Summary copied to clipboard!");
                    }
                  }}
                  disabled={!summary}
                  className="bg-[#111722] hover:bg-[#162030] disabled:opacity-40 text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-[#1e293b] flex items-center gap-1.5 transition"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Full-Width Bottom Card: Voice & Text Copilot */}
        <div className="bg-[#0b0f17] border border-[#151d2a] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#17202f] pb-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-lime-400" />
              <h2 className="text-sm font-bold text-white">
                Voice & Text Copilot
              </h2>
            </div>
            <span className="text-[11px] font-medium bg-[#111722] border border-[#1e293b] text-gray-400 px-2.5 py-0.5 rounded-full">
              Grounded Q&A
            </span>
          </div>

          {/* Chat Messages */}
          <div className="bg-[#080c14] border border-[#17202f] rounded-xl p-4 min-h-[160px] max-h-[220px] overflow-y-auto space-y-3">
            {messages.length === 0 && (
              <div className="h-28 flex flex-col items-center justify-center text-gray-600 text-xs gap-1">
                <span className="text-base text-gray-500">✨</span>
                <p>Upload a document and ask questions about its contents.</p>
              </div>
            )}
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[80%] text-xs p-3 rounded-xl ${
                    m.sender === "user"
                      ? "bg-[#84cc16] text-black font-medium"
                      : "bg-[#111722] border border-[#1e293b] text-gray-200"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Voice Input & Query Bar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-xl border border-[#1e293b] transition ${
                listening
                  ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                  : "bg-[#111722] hover:bg-[#162030] text-gray-400 hover:text-white"
              }`}
              title={listening ? "Listening..." : "Dictate with microphone"}
            >
              {listening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>

            <input
              type="text"
              placeholder={
                processedFile
                  ? "Ask a question about your documents..."
                  : "Upload a document first to chat..."
              }
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleSendMessage(chatInput)
              }
              disabled={!processedFile || answering}
              className="flex-1 bg-[#080c14] border border-[#17202f] rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 outline-none focus:border-lime-500 transition"
            />

            <button
              type="button"
              onClick={() => handleSendMessage(chatInput)}
              disabled={!processedFile || answering || !chatInput.trim()}
              className="bg-[#84cc16] hover:bg-[#65a30d] disabled:opacity-40 text-black p-3 rounded-xl transition shadow-md shadow-lime-950/40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
