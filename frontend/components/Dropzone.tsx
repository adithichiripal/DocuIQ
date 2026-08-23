import React, { useRef, useState } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  Globe,
  FileCheck,
  Layers,
} from "lucide-react";

export interface DocMetadata {
  method: string;
  pages: number;
  word_count: number;
  size_kb: number;
  uploaded_at: string;
}

interface DropzoneProps {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  serverDocs: Record<string, DocMetadata>;
  onDeleteServerDoc: (filename: string) => void;
  onUpload: () => void;
  isUploading: boolean;
  targetLang: string;
  setTargetLang: (lang: string) => void;
  onResetAll: () => void;
}

const LANGUAGES = [
  "English",
  "Spanish",
  "Hindi",
  "French",
  "German",
  "Japanese",
  "Chinese",
  "Arabic",
  "Tamil",
  "Telugu",
];

export default function Dropzone({
  files,
  setFiles,
  serverDocs,
  onDeleteServerDoc,
  onUpload,
  isUploading,
  targetLang,
  setTargetLang,
  onResetAll,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(
      (f) =>
        f.type.includes("pdf") ||
        f.type.includes("image") ||
        f.name.endsWith(".pdf"),
    );
    setFiles((prev) => [...prev, ...valid]);
  };

  const removeLocalFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const serverDocKeys = Object.keys(serverDocs);

  return (
    <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
            Document Management
          </h2>
          <button
            onClick={onResetAll}
            className="text-xs text-zinc-400 hover:text-red-400 transition"
          >
            Clear Session
          </button>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-lime-400 bg-lime-500/5"
              : "border-zinc-700 bg-black/40 hover:border-zinc-600"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-10 h-10 rounded-full bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400 mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-white mb-1">
            Upload New Documents
          </span>
          <span className="text-xs text-zinc-500 text-center">
            PDFs, Scans, Receipts, Images
          </span>
        </div>

        {/* Language Selection */}
        <div className="mt-4 flex items-center justify-between bg-black/40 border border-zinc-800 p-2.5 rounded-xl">
          <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-lime-400" /> Output Language:
          </span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-xs text-lime-300 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer focus:border-lime-400"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        {/* Active Ingested Documents List */}
        {serverDocKeys.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Processed Context ({serverDocKeys.length})
            </span>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {serverDocKeys.map((name) => {
                const doc = serverDocs[name];
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800 p-2.5 rounded-xl text-xs"
                  >
                    <div className="flex flex-col gap-1 truncate mr-2">
                      <div className="flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                        <span className="text-zinc-200 font-medium truncate">
                          {name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                        <span className="bg-lime-500/10 text-lime-400 px-1.5 py-0.5 rounded border border-lime-500/20">
                          {doc.method}
                        </span>
                        <span>{doc.pages} pg</span>
                        <span>•</span>
                        <span>{doc.word_count} words</span>
                        <span>•</span>
                        <span>{doc.size_kb} KB</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteServerDoc(name)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      title="Delete document from session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Uploads */}
        {files.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <span className="text-xs font-semibold text-yellow-400/80 uppercase tracking-wider">
              Queue to Upload ({files.length})
            </span>
            {files.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-black/60 border border-yellow-500/20 px-3 py-1.5 rounded-lg text-xs"
              >
                <span className="text-zinc-300 truncate">{f.name}</span>
                <button
                  onClick={() => removeLocalFile(idx)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onUpload}
        disabled={
          (files.length === 0 && serverDocKeys.length === 0) || isUploading
        }
        className="w-full mt-5 bg-lime-500 hover:bg-lime-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold text-sm py-3 rounded-xl transition-all duration-200 shadow-lg shadow-lime-500/10 flex items-center justify-center gap-2"
      >
        {isUploading ? (
          <>
            <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
            Processing & Summarizing...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            {files.length > 0
              ? "Upload & Generate Summary"
              : "Regenerate Summary"}
          </>
        )}
      </button>
    </div>
  );
}
