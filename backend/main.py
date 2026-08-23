import os
import sqlite3
import tempfile
from typing import AsyncGenerator
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import fitz  # PyMuPDF
from groq import Groq
from pydantic import BaseModel

# Initialize Groq client
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Ultra-fast open production models on Groq
GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
]

app = FastAPI(title="DocuIQ Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = os.path.join(tempfile.gettempdir(), "docuiq.db")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            filename TEXT,
            extracted_text TEXT,
            word_count INTEGER,
            page_count INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

def extract_pdf_text(file_bytes: bytes, max_pages: int = 35) -> tuple[str, int]:
    text_chunks = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        total_pages = min(len(doc), max_pages)
        for page_idx in range(total_pages):
            page = doc[page_idx]
            text = page.get_text().strip()
            if text:
                text_chunks.append(f"--- Page {page_idx + 1} ---\n{text}")
                
    extracted = "\n\n".join(text_chunks)
    return (extracted if extracted else "Visual document content."), total_pages

def budget_tokens(text: str, max_chars: int = 35000) -> str:
    if len(text) > max_chars:
        half = max_chars // 2
        return text[:half] + "\n\n[... truncated ...]\n\n" + text[-half:]
    return text

@app.get("/")
@app.get("/health")
def health_check():
    return JSONResponse(content={"status": "online", "service": "DocuIQ Backend API"})

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), doc_id: str = Form(...)):
    try:
        content = await file.read()
        filename = file.filename or "document"
        
        if filename.lower().endswith(".pdf"):
            extracted_text, total_pages = extract_pdf_text(content)
        else:
            extracted_text = f"Uploaded visual document: {filename}."
            total_pages = 1
            
        word_count = len(extracted_text.split())
        
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO documents (id, filename, extracted_text, word_count, page_count) VALUES (?, ?, ?, ?, ?)",
            (doc_id, filename, extracted_text, word_count, total_pages)
        )
        conn.commit()
        conn.close()
        
        return {
            "id": doc_id,
            "filename": filename,
            "page_count": total_pages,
            "word_count": word_count,
            "preview": extracted_text[:300]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")

class SummarizeRequest(BaseModel):
    doc_id: str
    length: str = "Medium"
    language: str = "English"

@app.post("/summarize")
async def summarize_document(req: SummarizeRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT extracted_text FROM documents WHERE id = ?", (req.doc_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Document text not found")
        
    doc_text = budget_tokens(row[0])
    system_prompt = f"You are DocuIQ, an expert document intelligence assistant. Summarize the content in {req.language}. Desired Length/Style: {req.length}. Use clean markdown formatting with bullet points."
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        if not groq_client:
            yield "\n[Error: GROQ_API_KEY environment variable is missing on Render.]"
            return
            
        last_error = ""
        for model_name in GROQ_MODELS:
            try:
                response = groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"DOCUMENT CONTENT:\n{doc_text}"},
                    ],
                    stream=True,
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                last_error = str(e)
                continue
                
        yield f"\n[Streaming Error: {last_error}]"

    return StreamingResponse(generate_stream(), media_type="text/plain")

class ChatRequest(BaseModel):
    doc_id: str
    question: str

@app.post("/chat")
async def chat_document(req: ChatRequest):
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("SELECT extracted_text FROM documents WHERE id = ?", (req.doc_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Document text not found")
        
    doc_text = budget_tokens(row[0])
    system_prompt = "You are DocuIQ Copilot. Answer user questions strictly based ONLY on the provided document. If information is absent, state: 'I cannot find this information in the document.'"
    
    async def generate_chat_stream() -> AsyncGenerator[str, None]:
        if not groq_client:
            yield "\n[Error: GROQ_API_KEY is missing on Render.]"
            return
            
        last_error = ""
        for model_name in GROQ_MODELS:
            try:
                response = groq_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"DOCUMENT CONTEXT:\n{doc_text}\n\nQUESTION:\n{req.question}"},
                    ],
                    stream=True,
                )
                for chunk in response:
                    content = chunk.choices[0].delta.content
                    if content:
                        yield content
                return
            except Exception as e:
                last_error = str(e)
                continue
                
        yield f"\n[Chat Error: {last_error}]"

    return StreamingResponse(generate_chat_stream(), media_type="text/plain")