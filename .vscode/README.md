# 📄 DocuIQ — Next-Gen Document Intelligence & Voice Copilot

DocuIQ is an enterprise-grade document intelligence platform designed to ingest multi-format documents (PDFs, images, scanned receipts), extract textual data using native parsers with OCR fallback, and stream structured AI summaries in multiple languages. It also provides a grounded, interactive voice and text copilot powered by Google Gemini.

---

## 🏗️ System Architecture

+---------------------------+
| Next.js 14 + TailwindCSS |
| (Voice & Markdown UI) |
+-------------+-------------+
|
REST API / Token Streams (Fetch API)
|
v
+---------------------------+
| FastAPI Async Server |
+-------------+-------------+
|
+--------------------------+--------------------------+
| | |
v v v
+-----------------------+ +-----------------------+ +-----------------------+
| PyPDF & Tesseract | | SQLite (SQLAlchemy) | | Google Gemini API |
| (OCR Engine) | | (Persistent Store) | | (gemini-3.6-flash) |
+-----------------------+ +-----------------------+ +-----------------------+

---

## ✨ Key Features

- **Multi-Document Ingestion**: Upload native text PDFs, scanned documents, invoices, receipts, and images.
- **OCR Engine with Metadata Badges**: Automatically detects document type, displays page counts, word counts, and extraction methods (`Native PDF`, `Tesseract OCR`, `Plain Text`).
- **Low-Latency Streaming Summaries**: Real-time Markdown token streaming powered by `gemini-3.6-flash`.
- **Multilingual Synthesis**: Instantly translate executive summaries into 10+ target languages (English, Spanish, Hindi, French, German, Japanese, etc.).
- **Voice-Interactive Copilot**: Speech-to-Text input and grounded Text-to-Speech audio playback answering queries strictly from document context.
- **Export Capabilities**: One-click download of generated intelligence reports as formatted **PDF** and **TXT** files.
- **Session Persistence**: Relational SQLite storage retains document context, summaries, and chat history across page refreshes.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons, React Markdown, jsPDF.
- **Backend**: FastAPI, Uvicorn, Pydantic, Python-Multipart.
- **OCR & Document Processing**: PyPDF, Tesseract OCR (`pytesseract`), Pillow (`PIL`).
- **AI Model**: Google Gemini API (`google-genai` SDK, `gemini-3.6-flash`).
- **Database**: SQLite with SQLAlchemy ORM.

---

## 🚀 Local Setup & Installation

### Prerequisites

- Python 3.10+
- Node.js 18+
- [Tesseract OCR](https://github.com/UB-Mannheim/tesseract/wiki) installed on your system.
- Google AI Studio API Key.

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your Gemini API key
echo GEMINI_API_KEY="your_actual_gemini_api_key" > .env

# Run FastAPI Server
python main.py
```
