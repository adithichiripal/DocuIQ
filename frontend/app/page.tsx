"use client";

import React, { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Dropzone, { DocMetadata } from "@/components/Dropzone";
import SummaryCard from "@/components/SummaryCard";
import ChatCopilot from "@/components/ChatCopilot";

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [serverDocs, setServerDocs] = useState<Record<string, DocMetadata>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [summaryLength, setSummaryLength] = useState<string>("medium");
  const [targetLang, setTargetLang] = useState<string>("English");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);

  // Restore session cleanly via async helper
  useEffect(() => {
    const restoreSavedSession = async () => {
      const savedSessionId = localStorage.getItem("docuiq_session_id");
      if (!savedSessionId) return;

      try {
        const res = await fetch(
          `http://localhost:8000/api/sessions/${savedSessionId}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSessionId(savedSessionId);
          setServerDocs(data.documents || {});
          if (data.summary && data.summary[summaryLength]) {
            setSummary(data.summary[summaryLength]);
          }
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      }
    };

    restoreSavedSession();
  }, [summaryLength]);

  const handleUploadAndProcess = async () => {
    setIsUploading(true);

    try {
      let activeSession = sessionId;

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        if (sessionId) formData.append("session_id", sessionId);

        const res = await fetch("http://localhost:8000/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok) {
          activeSession = data.session_id;
          setSessionId(data.session_id);
          localStorage.setItem("docuiq_session_id", data.session_id);
          setServerDocs(data.documents);
          setFiles([]);
        } else {
          alert(`Upload failed: ${data.detail || "Unknown error"}`);
          return;
        }
      }

      if (activeSession) {
        await streamSummary(activeSession, summaryLength, targetLang);
      }
    } catch (err) {
      console.error(err);
      alert("Could not reach backend server at http://localhost:8000");
    } finally {
      setIsUploading(false);
    }
  };

  const streamSummary = async (
    activeSessionId: string,
    length: string,
    lang: string,
  ) => {
    setIsSummarizing(true);
    setSummary("");

    try {
      const res = await fetch("http://localhost:8000/api/summarize-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: activeSessionId,
          summary_length: length,
          target_language: lang,
        }),
      });

      if (!res.ok || !res.body) {
        alert("Failed to generate summary.");
        setIsSummarizing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;
        setSummary(accumulated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDeleteServerDoc = async (filename: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch("http://localhost:8000/api/delete-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, filename }),
      });
      const data = await res.json();
      if (res.ok) {
        setServerDocs(data.documents);
        if (Object.keys(data.documents).length === 0) {
          setSummary("");
        } else {
          await streamSummary(sessionId, summaryLength, targetLang);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetSession = () => {
    localStorage.removeItem("docuiq_session_id");
    setFiles([]);
    setServerDocs({});
    setSessionId(null);
    setSummary("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <span className="inline-flex items-center gap-1.5 text-xs text-lime-400 border border-lime-500/20 bg-lime-500/5 px-3 py-1 rounded-full mb-3 font-mono">
            ⚡ SQLite Persistent & Streaming AI
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            AI Document Summarizer & Voice Copilot
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Multi-document extraction with persistent sessions, OCR badges, and
            instant voice interaction.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Dropzone
            files={files}
            setFiles={setFiles}
            serverDocs={serverDocs}
            onDeleteServerDoc={handleDeleteServerDoc}
            onUpload={handleUploadAndProcess}
            isUploading={isUploading || isSummarizing}
            targetLang={targetLang}
            setTargetLang={(l) => {
              setTargetLang(l);
              if (sessionId) streamSummary(sessionId, summaryLength, l);
            }}
            onResetAll={handleResetSession}
          />

          <SummaryCard
            summary={summary}
            length={summaryLength}
            setLength={setSummaryLength}
            isLoading={isSummarizing && summary.length === 0}
            onRegenerate={(len) =>
              sessionId && streamSummary(sessionId, len, targetLang)
            }
            targetLang={targetLang}
          />
        </div>

        <ChatCopilot sessionId={sessionId} />
      </main>
    </div>
  );
}
