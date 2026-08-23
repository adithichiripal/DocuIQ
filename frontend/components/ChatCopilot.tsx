"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, MicOff, Volume2, Bot, User, Sparkles } from "lucide-react";

interface Message {
  sender: "user" | "ai";
  text: string;
}

interface ChatCopilotProps {
  sessionId: string | null;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatCopilot({ sessionId }: ChatCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load chat history from SQLite when session changes
  useEffect(() => {
    if (sessionId) {
      fetch(`${API_BASE}/api/sessions/${sessionId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.chat_history && data.chat_history.length > 0) {
            setMessages(data.chat_history);
          }
        })
        .catch((err) => console.error("Error fetching chat history:", err));
    }
  }, [sessionId]);

  const handleSendMessage = async (customMessage?: string) => {
    const msgToSend = customMessage || input;
    if (!msgToSend.trim() || !sessionId || isSending) return;

    const userMsg: Message = { sender: "user", text: msgToSend };
    const initialAiMsg: Message = { sender: "ai", text: "" };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: msgToSend }),
      });

      if (!res.ok || !res.body) {
        setIsSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullReply += chunk;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { sender: "ai", text: fullReply };
          return updated;
        });
      }

      // Voice read-back
      if ("speechSynthesis" in window && fullReply) {
        const utterance = new SpeechSynthesisUtterance(fullReply);
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSpeechInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech Recognition is not supported by your browser. Please use Google Chrome or Edge.",
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      handleSendMessage(transcript);
    };

    recognition.start();
  };

  const handleTextToSpeech = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-lime-400" />
          <h2 className="text-lg font-semibold text-white">
            Voice & Text Copilot
          </h2>
        </div>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
          Grounded Q&A
        </span>
      </div>

      <div className="h-64 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-zinc-700">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-sm">
            <Sparkles className="w-8 h-8 mb-2 text-zinc-600" />
            <p>Upload a document and ask questions about its contents.</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.sender === "ai" && (
                <div className="w-7 h-7 rounded-full bg-lime-500/10 border border-lime-500/30 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-lime-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.sender === "user"
                    ? "bg-lime-500 text-black font-medium"
                    : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                }`}
              >
                <p className="whitespace-pre-wrap">
                  {msg.text ||
                    (isSending && idx === messages.length - 1
                      ? "Generating response..."
                      : "")}
                </p>
                {msg.sender === "ai" && msg.text && (
                  <button
                    onClick={() => handleTextToSpeech(msg.text)}
                    className="mt-2 text-zinc-400 hover:text-white flex items-center gap-1 text-xs transition"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Speak
                  </button>
                )}
              </div>
              {msg.sender === "user" && (
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-zinc-300" />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleSpeechInput}
          className={`p-2.5 rounded-lg border transition ${
            isListening
              ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
              : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
          }`}
          title="Speech to Text"
        >
          {isListening ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            sessionId
              ? "Ask a question about your documents..."
              : "Upload documents first to start chatting..."
          }
          disabled={!sessionId || isSending}
          className="flex-1 bg-zinc-800/80 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-500 disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!sessionId || !input.trim() || isSending}
          className="bg-lime-500 hover:bg-lime-400 disabled:opacity-50 text-black px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-1.5 transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
