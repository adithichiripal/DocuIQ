"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  UploadCloud,
  FileText,
  Sparkles,
  Send,
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Layers,
  Languages,
  Zap,
  Bot,
} from "lucide-react";

export default function DocuIQDashboard() {
  const [docId] = useState<string>(
    () => "doc_" + Math.random().toString(36).substring(2, 9),
  );
  const [, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [docMeta, setDocMeta] = useState<{
    filename: string;
    word_count: number;
    page_count: number;
  } | null>(null);

  // Summary State
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [granularity, setGranularity] = useState("Medium");
  const [language, setLanguage] = useState("English");

  // Copilot Chat State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    { sender: "user" | "ai"; text: string }[]
  >([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Backend Health
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://docuiq-backend.onrender.com";

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async (attempts = 3) => {
      for (let i = 0; i < attempts; i++) {
        try {
          const res = await fetch(`${apiUrl}/health`);
          if (res.ok && isMounted) {
            setBackendStatus("online");
            return;
          }
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
      if (isMounted) setBackendStatus("offline");
    };
    checkBackend();
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
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploading(true);
    setSummary("");
    setMessages([]);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("doc_id", docId);

    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setDocMeta({
        filename: data.filename,
        word_count: data.word_count,
        page_count: data.page_count,
      });
      triggerSummary(docId, granularity, language);
    } catch (err) {
      console.error(err);
      alert(
        "Error processing document. Ensure backend is online and file is supported.",
      );
    } finally {
      setUploading(false);
    }
  };

  // Stream Summary
  const triggerSummary = async (
    activeDocId: string,
    sumGranularity: string,
    sumLang: string,
  ) => {
    setSummarizing(true);
    setSummary("");
    try {
      const res = await fetch(`${apiUrl}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: activeDocId,
          length: sumGranularity,
          language: sumLang,
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
      setSummary("Error streaming summary from backend.");
    } finally {
      setSummarizing(false);
    }
  };

  // Stream Chat
  const handleSendMessage = async (userText: string) => {
    if (!userText.trim() || !docMeta) return;

    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setChatInput("");
    setIsAnswering(true);

    try {
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: docId, question: userText }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let aiResponseText = "";

      setMessages((prev) => [...prev, { sender: "ai", text: "" }]);

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value, { stream: true });
        aiResponseText += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: "ai", text: aiResponseText };
          return updated;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnswering(false);
    }
  };

  // Web Speech
  const toggleSpeechRecognition = () => {
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

    if (!isListening) {
      recognition.start();
      setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(transcript);
        handleSendMessage(transcript);
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
    } else {
      recognition.stop();
      setIsListening(false);
    }
  };

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col antialiased selection:bg-emerald-500/30">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-950/50">
              <div className="h-full w-full bg-[#0b0f19] rounded-[10px] flex items-center justify-center">
                <Zap className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">
                  Docu<span className="text-emerald-400">IQ</span>
                </span>
                <span className="text-[10px] uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  v2.0 Pro
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Intelligent Multimodal Document Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {backendStatus === "online" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/50 text-emerald-400 border border-emerald-800/50 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                System Ready
              </span>
            ) : backendStatus === "checking" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-950/50 text-amber-300 border border-amber-800/50 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting Cloud
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-950/50 text-rose-300 border border-rose-800/50 shadow-sm">
                <AlertCircle className="h-3.5 w-3.5" />
                Backend Offline
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Upload & Configurations */}
        <div className="lg:col-span-4 space-y-5">
          {/* Ingestion Dropzone */}
          <div className="relative group border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-2xl p-6 bg-slate-900/30 transition-all text-center">
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-slate-800/70 group-hover:bg-emerald-500/10 group-hover:text-emerald-400 border border-slate-700/60 group-hover:border-emerald-500/30 flex items-center justify-center transition-all shadow-inner">
                {uploading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
                ) : (
                  <UploadCloud className="h-7 w-7 text-slate-300" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  {uploading
                    ? "Ingesting & Analyzing..."
                    : "Upload New Documents"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PDFs, Scans, Receipts, Images
                </p>
              </div>
            </div>
          </div>

          {/* Active File Card */}
          {docMeta && (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 shadow-sm backdrop-blur-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {docMeta.filename}
                  </p>
                  <p className="text-[11px] text-emerald-400/80 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="h-3 w-3" /> Processed via PyMuPDF &
                    OCR
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Total Pages
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {docMeta.page_count}
                  </span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-2.5">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                    Word Count
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {docMeta.word_count.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Granularity & Parameters */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 shadow-sm backdrop-blur-sm space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2.5">
                <Layers className="h-3.5 w-3.5 text-emerald-400" /> Granularity
                Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Short", "Medium", "Long"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setGranularity(lvl);
                      if (docMeta) triggerSummary(docId, lvl, language);
                    }}
                    className={`py-2 text-xs font-medium rounded-xl border transition-all ${
                      granularity === lvl
                        ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-sm"
                        : "bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                <Languages className="h-3.5 w-3.5 text-emerald-400" /> Target
                Language
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  if (docMeta)
                    triggerSummary(docId, granularity, e.target.value);
                }}
                className="w-full bg-slate-950/60 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 focus:border-emerald-500 outline-none"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Insights & Copilot Chat */}
        <div className="lg:col-span-8 space-y-6">
          {/* Streaming Summary Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <h2 className="text-sm font-semibold text-slate-200">
                  Streaming AI Analysis
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {summary && (
                  <button
                    onClick={() => speakText(summary)}
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 transition"
                    title="Audio Readout"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
                {docMeta && (
                  <button
                    onClick={() => triggerSummary(docId, granularity, language)}
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                    title="Regenerate"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 text-sm text-slate-300 leading-relaxed overflow-y-auto max-h-[360px] pr-2">
              {summarizing && !summary && (
                <div className="flex items-center gap-3 text-slate-400 text-xs py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                  <span>Streaming synthesized response tokens...</span>
                </div>
              )}
              {summary ? (
                <div className="whitespace-pre-wrap font-sans text-slate-200">
                  {summary}
                </div>
              ) : (
                !summarizing && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-xs py-12">
                    <Bot className="h-8 w-8 mb-2 stroke-[1.5]" />
                    <p>
                      Upload documents and hit process to view formatted
                      insights.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Grounded Copilot Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 shadow-sm backdrop-blur-sm flex flex-col h-[400px]">
            <div className="flex items-center gap-2 border-b border-slate-800/60 pb-3 mb-4">
              <Bot className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-200">
                Grounded Copilot
              </h2>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 mb-4">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs italic">
                  Ask targeted questions strictly verified against document
                  context.
                </div>
              )}
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] text-xs rounded-2xl px-4 py-3 leading-relaxed shadow-sm ${
                      m.sender === "user"
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-slate-950/80 border border-slate-800 text-slate-200 rounded-bl-none"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Voice & Input Controls */}
            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl p-2">
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`p-2.5 rounded-lg transition-all ${
                  isListening
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
                title={isListening ? "Listening..." : "Dictate via microphone"}
              >
                {isListening ? (
                  <MicOff className="h-4 w-4 animate-pulse text-rose-400" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              <input
                type="text"
                placeholder={
                  docMeta
                    ? "Ask any detail from the document..."
                    : "Upload document first to start chatting..."
                }
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendMessage(chatInput)
                }
                disabled={!docMeta || isAnswering}
                className="bg-transparent flex-1 text-xs text-slate-100 placeholder-slate-500 outline-none px-2"
              />

              <button
                type="button"
                onClick={() => handleSendMessage(chatInput)}
                disabled={!docMeta || isAnswering || !chatInput.trim()}
                className="h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white flex items-center justify-center transition-all shadow-sm"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
