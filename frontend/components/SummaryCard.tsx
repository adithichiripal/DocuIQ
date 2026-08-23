import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import jsPDF from 'jspdf';
import { Copy, Volume2, Check, Download, FileDown } from 'lucide-react';

interface SummaryCardProps {
  summary: string;
  length: string;
  setLength: (len: string) => void;
  isLoading: boolean;
  onRegenerate: (len: string) => void;
  targetLang: string;
}

export default function SummaryCard({
  summary,
  length,
  setLength,
  isLoading,
  onRegenerate,
  targetLang
}: SummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const speakSummary = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(summary);
    window.speechSynthesis.speak(utterance);
  };

  const downloadTXT = () => {
    const element = document.createElement('a');
    const file = new Blob([summary], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `DocuIQ_Summary_${length}_${targetLang}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('DOCUIQ - Document Intelligence Summary', 14, 20);
    doc.setFontSize(10);
    doc.text(`Length: ${length.toUpperCase()} | Language: ${targetLang} | Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    const splitText = doc.splitTextToSize(summary.replace(/[#*`]/g, ''), 180);
    doc.text(splitText, 14, 40);
    doc.save(`DocuIQ_Summary_${length}_${targetLang}.pdf`);
  };

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">AI Intelligence Summary</h2>
          
          <div className="flex bg-black/60 border border-zinc-700 p-1 rounded-lg text-xs">
            {['short', 'medium', 'long'].map((l) => (
              <button
                key={l}
                onClick={() => { setLength(l); onRegenerate(l); }}
                className={`px-3 py-1 rounded capitalize transition-all duration-150 ${
                  length === l
                    ? 'bg-lime-500 text-black font-semibold shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Markdown Render Container */}
        <div className="bg-black/60 border border-zinc-800/80 rounded-xl p-5 min-h-[260px] max-h-[400px] overflow-y-auto text-sm text-zinc-300 leading-relaxed">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-3 py-16">
              <span className="w-7 h-7 border-2 border-lime-400 border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs text-zinc-400">Analyzing structure & generating summary...</span>
            </div>
          ) : summary ? (
            <div className="prose prose-invert prose-sm max-w-none space-y-2">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-base font-bold text-lime-400 mt-2 mb-1">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-bold text-lime-300 mt-2 mb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xs font-bold text-zinc-200 mt-2 mb-0.5">{children}</h3>,
                  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
                  li: ({ children }) => <li className="text-zinc-300 text-xs">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                  p: ({ children }) => <p className="mb-2 text-xs leading-relaxed text-zinc-300">{children}</p>,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-16 text-zinc-500 text-xs">
              <span>Upload documents and hit process to view formatted insights.</span>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-800/60">
          {/* Export Options */}
          <div className="flex items-center space-x-2">
            <button
              onClick={downloadPDF}
              className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 hover:border-lime-500/50 text-zinc-300 px-2.5 py-1.5 rounded-lg transition"
            >
              <FileDown className="w-3.5 h-3.5 text-red-400" /> PDF
            </button>
            <button
              onClick={downloadTXT}
              className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 hover:border-lime-500/50 text-zinc-300 px-2.5 py-1.5 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" /> TXT
            </button>
          </div>

          {/* Action Options */}
          <div className="flex items-center space-x-2">
            <button
              onClick={speakSummary}
              className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg transition"
            >
              <Volume2 className="w-3.5 h-3.5 text-lime-400" /> Listen
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-lime-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}