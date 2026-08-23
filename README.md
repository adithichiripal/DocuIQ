# 📝 Plaintext

### AI-Powered Document Summarization & Intelligent Document Assistant

**Plaintext** is a modern AI-powered document intelligence platform that transforms lengthy documents into concise, structured, and easy-to-understand summaries.

Designed with a clean, responsive interface and a full-stack architecture, Plaintext allows users to upload documents, generate AI-powered summaries, interact with their documents through an AI Copilot, and listen to generated content using text-to-speech.

> **Read less. Understand more.**

---

## ✨ Features

### 📄 Intelligent Document Summarization

* Generate concise AI-powered summaries from lengthy documents.
* Extract the most important information while preserving context.
* Convert complex content into easier-to-understand explanations.
* Designed to handle documents efficiently through a dedicated backend.

### 🤖 AI Copilot

Interact with your document using a conversational AI assistant.

Ask questions such as:

* **"What is this document about?"**
* **"Summarize the key findings."**
* **"Explain this section in simple terms."**
* **"What are the important conclusions?"**
* **"Give me the main points as bullet points."**

The Copilot provides an interactive way to explore information instead of manually searching through long documents.

### 🔊 Text-to-Speech

Listen to generated summaries instead of reading them.

* Play generated content using text-to-speech.
* Pause and resume playback.
* Control speech output from the dashboard.
* Useful for accessibility and hands-free consumption.

### ⚡ Real-Time AI Responses

The application supports streaming AI responses to provide a smoother user experience instead of waiting for the entire response to be generated.

### 🎨 Modern Dashboard

A clean and responsive dashboard designed around usability.

* Minimal interface
* Responsive layout
* AI Copilot interface
* TTS controls
* Clear information hierarchy
* Smooth interaction between document content and AI features

### 🔐 Secure API Architecture

The frontend communicates with a dedicated FastAPI backend rather than directly exposing AI credentials.

This keeps sensitive API keys on the server side and provides a clean separation between the frontend and AI processing layer.

---

# 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │       User           │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Next.js Frontend   │
                         │                      │
                         │ • Dashboard         │
                         │ • Summarization UI  │
                         │ • AI Copilot        │
                         │ • TTS Controls      │
                         └──────────┬───────────┘
                                    │
                             HTTP / Streaming
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    FastAPI Backend   │
                         │                      │
                         │ • API Endpoints     │
                         │ • Request Handling  │
                         │ • AI Processing     │
                         │ • Streaming         │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │     Groq API         │
                         │                      │
                         │   Large Language     │
                         │      Models          │
                         └──────────────────────┘
```

---

# 🛠️ Tech Stack

## Frontend

| Technology              | Purpose                        |
| ----------------------- | ------------------------------ |
| **Next.js**             | React-based frontend framework |
| **React**               | Interactive UI                 |
| **TypeScript**          | Type-safe development          |
| **CSS / UI Components** | Responsive interface           |
| **Web APIs**            | Text-to-speech functionality   |

## Backend

| Technology              | Purpose             |
| ----------------------- | ------------------- |
| **Python**              | Backend development |
| **FastAPI**             | REST API and server |
| **Uvicorn**             | ASGI server         |
| **Groq API**            | AI inference        |
| **Streaming Responses** | Real-time AI output |

## Deployment

| Platform   | Component      |
| ---------- | -------------- |
| **Vercel** | Frontend       |
| **Render** | Backend        |
| **GitHub** | Source control |

---

# 📂 Project Structure

```text
plaintext/
│
├── backend/
│   ├── main.py
│   │   └── FastAPI server
│   │       API endpoints
│   │       AI processing
│   │       Streaming handlers
│   │
│   └── requirements.txt
│       └── Python dependencies
│
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   │   └── Root layout & fonts
│   │   │
│   │   └── page.tsx
│   │       └── Main dashboard
│   │           Document interface
│   │           TTS controls
│   │           AI Copilot
│   │
│   ├── package.json
│   │   └── Frontend dependencies & scripts
│   │
│   └── tsconfig.json
│       └── TypeScript configuration
│
├── README.md
└── LICENSE
```

---

# 🚀 Getting Started

Follow the steps below to run Plaintext locally.

## Prerequisites

Make sure the following are installed:

* **Python 3.10+**
* **Node.js 18+**
* **npm**
* **Git**
* A **Groq API key**

---

# 1️⃣ Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>

cd plaintext
```

---

# 2️⃣ Backend Setup

Navigate to the backend:

```bash
cd backend
```

### Create a virtual environment

```bash
python -m venv venv
```

### Activate the environment

### Windows PowerShell

```powershell
.\venv\Scripts\Activate.ps1
```

### Linux / macOS

```bash
source venv/bin/activate
```

### Install dependencies

```bash
pip install -r requirements.txt
```

---

# 3️⃣ Configure Environment Variables

Create a `.env` file inside the `backend` directory:

```env
GROQ_API_KEY=gsk_your_groq_api_key_here
```

> ⚠️ **Never commit your `.env` file or API keys to GitHub.**

Make sure `.env` is included in `.gitignore`:

```text
.env
venv/
__pycache__/
```

---

# 4️⃣ Start the Backend

From the `backend` directory:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

FastAPI also provides interactive API documentation at:

```text
http://localhost:8000/docs
```

---

# 5️⃣ Frontend Setup

Open a new terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

---

## Configure the Backend URL

Create:

```text
.env.local
```

Add:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

This allows the Next.js application to communicate with the local FastAPI backend.

---

# 6️⃣ Start the Frontend

```bash
npm run dev
```

Open the application in your browser:

```text
http://localhost:3000
```

---

# 🔑 Environment Variables

### Backend

| Variable       | Description                   | Required |
| -------------- | ----------------------------- | -------- |
| `GROQ_API_KEY` | API key used for AI inference | ✅        |

### Frontend

| Variable              | Description                | Required |
| --------------------- | -------------------------- | -------- |
| `NEXT_PUBLIC_API_URL` | URL of the FastAPI backend | ✅        |

### Local Development

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production

```env
NEXT_PUBLIC_API_URL=https://your-backend-name.onrender.com
```

---

# 🌐 Production Deployment

Plaintext uses a separated frontend/backend deployment architecture.

```text
GitHub
   │
   ├──────────────► Render
   │                 │
   │                 └── FastAPI Backend
   │
   └──────────────► Vercel
                     │
                     └── Next.js Frontend
```

---

## 🟣 Deploy Backend on Render

Create a new **Web Service** on Render and connect your GitHub repository.

Set the following configuration:

### Root Directory

```text
backend
```

### Build Command

```bash
pip install -r requirements.txt
```

### Start Command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Environment Variables

Add:

```text
GROQ_API_KEY = gsk_your_groq_api_key_here
```

After deployment, Render will provide a backend URL similar to:

```text
https://your-backend-name.onrender.com
```

---

# ▲ Deploy Frontend on Vercel

Import the GitHub repository into Vercel.

Set the project **Root Directory** to:

```text
frontend
```

Vercel will automatically detect the Next.js application.

Add the following environment variable:

```text
NEXT_PUBLIC_API_URL=https://your-backend-name.onrender.com
```

Then deploy.

Your production architecture will be:

```text
User
 │
 ▼
Vercel
 │
 │ HTTPS
 ▼
Render
 │
 ▼
Groq API
```

---

# 🔒 Security Considerations

Plaintext follows a separated frontend/backend architecture to avoid exposing sensitive credentials.

### API keys stay on the backend

```text
❌ Frontend
NEXT_PUBLIC_GROQ_API_KEY

✅ Backend
GROQ_API_KEY
```

Never expose private API keys through variables prefixed with:

```text
NEXT_PUBLIC_
```

because Next.js exposes those variables to the browser.

Additional production recommendations:

* Keep secrets in platform environment variables.
* Never commit `.env` files.
* Validate incoming API requests.
* Configure CORS appropriately.
* Add rate limiting for public deployments.
* Monitor API usage and failures.
* Avoid logging sensitive user/document information.

---

# 🧪 Development Workflow

```text
1. User uploads / provides document
              ↓
2. Next.js frontend
              ↓
3. FastAPI API request
              ↓
4. Document processing
              ↓
5. Groq AI inference
              ↓
6. Streaming response
              ↓
7. Dashboard displays result
              ↓
8. User can interact using AI Copilot
              ↓
9. Optional Text-to-Speech playback
```

---

# 📡 API

The backend is built with FastAPI and exposes endpoints for communication with the frontend.

Once the backend is running, interactive API documentation is available at:

```text
http://localhost:8000/docs
```

FastAPI's automatically generated documentation makes it easy to test endpoints during development.

---

# 🖥️ Screenshots

> Add screenshots of the application here once the UI is finalized.

### Dashboard

```text
[ Add dashboard screenshot ]
```

### AI Copilot

```text
[ Add Copilot screenshot ]
```

### Text-to-Speech

```text
[ Add TTS screenshot ]
```

---

# 🎯 Why Plaintext?

Long documents are difficult to read, understand, and search manually.

Plaintext combines:

**Document Understanding + AI Summarization + Conversational AI + Accessibility**

into a single interface.

Instead of simply generating a summary, the platform is designed to let users **understand, question, and consume information in the way that works best for them.**

---

# 🗺️ Future Improvements

The project can be extended with:

* [ ] PDF document upload
* [ ] DOCX support
* [ ] Multiple document formats
* [ ] Document history
* [ ] User authentication
* [ ] Saved summaries
* [ ] Multi-document conversations
* [ ] Citation-aware answers
* [ ] Summary length controls
* [ ] Different summarization modes
* [ ] Document comparison
* [ ] Export summaries as PDF/DOCX
* [ ] Advanced RAG pipeline
* [ ] Vector database integration
* [ ] Multi-language support
* [ ] Improved accessibility
* [ ] Analytics dashboard

---

# 🤝 Contributing

Contributions are welcome.

### Fork the repository

```bash
git fork <repository-url>
```

### Create a feature branch

```bash
git checkout -b feature/your-feature
```

### Commit your changes

```bash
git add .
git commit -m "feat: add your feature"
```

### Push the branch

```bash
git push origin feature/your-feature
```

Then open a Pull Request.

---

# 📜 License

This project is open-source and available under the **MIT License**.

---

# 👩‍💻 Author

**Adithi Chiripal**

Built with ❤️ using **Next.js, TypeScript, FastAPI, Python, and Groq AI**.

---

## ⭐ Support

If you find Plaintext useful, consider giving the repository a ⭐ on GitHub.

> **Plaintext — Turn complex documents into clear understanding.**
