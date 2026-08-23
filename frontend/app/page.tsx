"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

export default function DocuIQApp() {
  // Initialize state directly with lazy initializer instead of calling setState in useEffect
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

  // Summarization State
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [length, setLength] = useState("Medium");
  const [language, setLanguage] = useState("English");

  // Chat State
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    { sender: "user" | "ai"; text: string }[]
  >([]);
  const [isAnswering, setIsAnswering] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Backend Status
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://docuiq-backend.onrender.com";

  // Check Backend Health on Mount with automatic retry
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

  // Handle Document Upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Trigger instant summary upon upload
      triggerSummary(docId, length, language);
    } catch (err) {
      console.error(err);
      alert(
        "Failed to process document. Please try a smaller file or standard PDF.",
      );
    } finally {
      setUploading(false);
    }
  };

  // Stream Summary
  const triggerSummary = async (
    activeDocId: string,
    sumLength: string,
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
          length: sumLength,
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
      setSummary("Error generating summary. Please check backend connection.");
    } finally {
      setSummarizing(false);
    }
  };

  // Stream Copilot Chat
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

  // Web Speech Recognition (Mic input)
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

  // Text to Speech
  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <main className="min-h-screen bg-black text-gray-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                DOCUIQ
              </h1>
              <p className="text-xs text-gray-400">
                Intelligent Multimodal Document Assistant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {backendStatus === "online" ? (
              <span className="flex items-center gap-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-3 py-1.5 rounded-full font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Backend Online
              </span>
            ) : backendStatus === "checking" ? (
              <span className="flex items-center gap-1.5 bg-yellow-950/60 text-yellow-400 border border-yellow-800/40 px-3 py-1.5 rounded-full font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting to
                Cloud...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-red-950/60 text-red-400 border border-red-800/40 px-3 py-1.5 rounded-full font-medium">
                <AlertCircle className="h-3.5 w-3.5" /> Backend Offline (Check
                Uptime)
              </span>
            )}
          </div>
        </header>

        {/* Upload & Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-4 space-y-4">
            {/* Upload Box */}
            <div className="border border-dashed border-gray-800 hover:border-emerald-500/50 bg-gray-950/50 p-6 rounded-2xl text-center relative transition-all">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <UploadCloud className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-200">
                    {uploading
                      ? "Ingesting Document..."
                      : "Drop PDF or Image here"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Multi-page PDFs, scans & receipts supported
                  </p>
                </div>
              </div>
            </div>

            {/* Document Metadata Badges */}
            {docMeta && (
              <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <FileText className="h-4 w-4" />
                  <span className="truncate">{docMeta.filename}</span>
                </div>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span className="bg-gray-900 px-2 py-1 rounded border border-gray-800">
                    {docMeta.page_count} Pages
                  </span>
                  <span className="bg-gray-900 px-2 py-1 rounded border border-gray-800">
                    {docMeta.word_count.toLocaleString()} Words
                  </span>
                </div>
              </div>
            )}

            {/* Granularity & Language Controls */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-xl p-4 space-y-3">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                Summary Granularity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {["Short", "Medium", "Long"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setLength(lvl);
                      if (docMeta) triggerSummary(docId, lvl, language);
                    }}
                    className={`py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      length === lvl
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-300"
                        : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block pt-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  if (docMeta) triggerSummary(docId, length, e.target.value);
                }}
                className="w-full bg-gray-900 border border-gray-800 text-xs text-gray-200 rounded-lg p-2 focus:border-emerald-500 outline-none"
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="French">French</option>
                <option value="German">German</option>
                <option value="Hindi">Hindi</option>
              </select>
            </div>
          </div>

          {/* Right Column: Streaming Summary & Grounded Copilot */}
          <div className="lg:col-span-8 space-y-6">
            {/* Live Streaming Summary Box */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 relative flex flex-col min-h-[260px]">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-400" />
                  Streaming AI Summary
                </h2>
                {summary && (
                  <button
                    onClick={() => speakText(summary)}
                    className="p-1.5 text-gray-400 hover:text-emerald-400 transition"
                    title="Read aloud"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto max-h-[350px]">
                {summarizing && !summary && (
                  <div className="flex items-center gap-2 text-gray-500 text-xs pt-4">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    Streaming summary chunks...
                  </div>
                )}
                {summary ||
                  (!summarizing &&
                    !docMeta &&
                    "Upload a document to extract insights.")}
              </div>
            </div>

            {/* Grounded Copilot Chat */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col h-[380px]">
              <h2 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-400" />
                Grounded Document Copilot
              </h2>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                {messages.length === 0 && (
                  <p className="text-xs text-gray-600 italic">
                    Ask questions strictly grounded in your uploaded document...
                  </p>
                )}
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] text-xs p-3 rounded-xl ${
                        m.sender === "user"
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-900 border border-gray-800 text-gray-200"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Bar with Voice Support */}
              <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-1.5">
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`p-2 rounded-lg transition ${
                    isListening
                      ? "bg-red-500 text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4 animate-pulse" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
                <input
                  type="text"
                  placeholder="Ask a grounded question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSendMessage(chatInput)
                  }
                  disabled={!docMeta || isAnswering}
                  className="bg-transparent flex-1 text-xs text-gray-100 placeholder-gray-500 outline-none px-2"
                />
                <button
                  type="button"
                  onClick={() => handleSendMessage(chatInput)}
                  disabled={!docMeta || isAnswering || !chatInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white p-2 rounded-lg transition"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
