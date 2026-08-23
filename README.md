# DocuIQ — Next-Gen AI Document Intelligence & Voice Copilot

DocuIQ is a high-performance document intelligence platform that extracts, structures, and synthesizes complex information from PDFs, receipts, and images. Featuring real-time streaming summaries, clean text-to-speech, and a grounded conversational copilot, DocuIQ runs on a modern decoupled full-stack architecture powered by high-speed LPU inference.

---

## 🔗 Live Deployments

- **Live Application**: [frontend-seven-mauve-78.vercel.app](frontend-seven-mauve-78.vercel.app)

---

## ⚡ Key Features

- **High-Speed Ingestion & OCR**: Ultra-fast native digital extraction via PyMuPDF with multimodal visual support.
- **Instant Streaming Summarization**: Multi-length (`Short`, `Medium`, `Long`) summaries streamed with sub-second time-to-first-token.
- **Multi-Language Intelligence**: Summarize and converse in English, Spanish, French, German, or Hindi.
- **Grounded Document Copilot**: Context-aware Q&A locked strictly to uploaded document contents to eliminate hallucinations.
- **Markdown-Aware Text-to-Speech (TTS)**: Clean voice synthesis engine that strips raw Markdown formatting syntax (`##`, `**`, `*`, `_`, `>`) and includes full **Play / Pause / Resume / Stop** controls.
- **High-Availability Inference**: Backed by high-throughput LPU inference with automated multi-model failover chains to prevent quota rate-limiting (`429`).
- **Session Persistence**: SQLite-backed document session state tracking word counts, page counts, and metadata.

---

## 🛠️ Architecture & Tech Stack

| Layer             | Technologies                                                                      |
| :---------------- | :-------------------------------------------------------------------------------- |
| **Frontend**      | Next.js 14/15 (App Router), React, TypeScript, Tailwind CSS, Lucide Icons         |
| **Backend**       | FastAPI, Uvicorn, SQLite, PyMuPDF (`fitz`), Pillow                                |
| **AI Inference**  | Groq LPU Engine (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.6-27b`) |
| **Speech Engine** | Web Speech Synthesis API & Web Speech Recognition API                             |
| **Deployment**    | Frontend on **Vercel**, Backend API on **Render**                                 |

---

## 🚀 Local Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+ & npm / pnpm / yarn
- A free [Groq Cloud API Key](https://console.groq.com/keys)

---

### 1. Backend Setup

````bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment configuration
echo "GROQ_API_KEY=gsk_your_groq_api_key_here" > .env

# Run FastAPI development server
uvicorn main:app --reload --host 0.0.0.0 --port 8000

2. Frontend Setup
Bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Set local backend URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Run Next.js development server
npm run dev
Open http://localhost:3000 in your browser.

🌐 Production Deployment Guide
Backend on Render
Create a new Web Service pointing to your repository root (/backend).

Set Build Command: pip install -r requirements.txt

Set Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT

In Environment Variables, add:

GROQ_API_KEY = gsk_...

Frontend on Vercel
Import repository into Vercel with the Root Directory set to frontend.

In Environment Variables, add:

NEXT_PUBLIC_API_URL = https://your-backend-name.onrender.com

Deploy.

📂 Project Structure
Plaintext
├── backend/
│   ├── main.py              # FastAPI server, endpoints, streaming handlers
│   └── requirements.txt     # Python runtime dependencies
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout & font definitions
│   │   └── page.tsx         # Dashboard UI, TTS controls, Copilot chat
│   ├── package.json         # Frontend packages & scripts
│   └── tsconfig.json        # Strict TypeScript rules
└── README.md
📄 License
This project is open-source and available under the MIT License.


---

### Push to GitHub

In your PowerShell terminal, run:

```powershell
git add README.md
git commit -m "docs: finalize production README documentation"
git push origin main
````
