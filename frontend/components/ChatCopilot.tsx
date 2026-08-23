const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
import React, { useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";

interface Message {
  sender: "user" | "ai";
  text: string;
}

interface ChatCopilotProps {
  sessionId: string | null;
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface CustomSpeechRecognition {
  lang: string;
  interimResults: boolean;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  start: () => void;
}

interface CustomWindow extends Window {
  SpeechRecognition?: new () => CustomSpeechRecognition;
  webkitSpeechRecognition?: new () => CustomSpeechRecognition;
}

export default function ChatCopilot({ sessionId }: ChatCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const toggleVoiceInput = () => {
    const customWin = window as unknown as CustomWindow;
    const SpeechRecognitionConstructor =
      customWin.SpeechRecognition || customWin.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      alert(
        "Speech Recognition is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
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

  const handleSendMessage = async (customMessage?: string) => {
    const msgToSend = customMessage || input;
    if (!msgToSend.trim() || !sessionId || isSending) return;

    const userMsg: Message = { sender: "user", text: msgToSend };
    const initialAiMsg: Message = { sender: "ai", text: "" };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat-stream", {
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

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl mt-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
            Interactive Copilot (Voice & Text)
          </h2>
          <span className="text-xs text-zinc-400">
            Grounded in Uploaded Content
          </span>
        </div>

        <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-4 h-64 overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 text-xs">
              <span>
                Have doubts about your document? Tap the microphone or type
                below.
              </span>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed ${
                    m.sender === "user"
                      ? "bg-lime-500 text-black font-medium"
                      : "bg-zinc-800 text-zinc-200 border border-zinc-700"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-2">
        <button
          onClick={toggleVoiceInput}
          disabled={!sessionId}
          className={`p-3 rounded-xl border transition ${
            isListening
              ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
              : "bg-black/60 border-zinc-700 hover:border-zinc-600 text-zinc-300"
          }`}
          title="Voice Ask"
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
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder={
            sessionId
              ? "Ask a question about the document..."
              : "Upload a document first..."
          }
          disabled={!sessionId || isSending}
          className="flex-1 bg-black/60 border border-zinc-700 focus:border-lime-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!sessionId || !input.trim() || isSending}
          className="p-3 bg-lime-500 hover:bg-lime-400 disabled:opacity-40 text-black rounded-xl transition shadow-lg shadow-lime-500/10"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
