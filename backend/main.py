import base64
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

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Active text models with automatic fallback
GROQ_TEXT_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
]

# Active vision model for OCR
GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview"

app = FastAPI(title="DocuIQ Backend", version="2.1.0")

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

def ocr_image_with_groq(image_bytes: bytes) -> str:
    """Extracts text from an image or scanned page using Groq Vision."""
    if not groq_client:
        return ""
    try:
        base64_img = base64.b64encode(image_bytes).decode("utf-8")
        response = groq_client.chat.completions.create(
            model=GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Transcribe all visible text, tables, numbers, and structured content from this image accurately. Output only the extracted content."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_img}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=2048,
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"Vision OCR Error: {e}")
        return ""

def extract_pdf_content(file_bytes: bytes, max_pages: int = 15) -> tuple[str, int]:
    """Extracts selectable text; falls back to Vision OCR for scanned pages."""
    text_chunks = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        total_pages = min(len(doc), max_pages)
        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_text = page.get_text().strip()
            
            # If page has no digital text, render page as image and run Vision OCR
            if len(page_text) < 30:
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("jpeg")
                ocr_text = ocr_image_with_groq(img_bytes)
                if ocr_text:
                    page_text = ocr_text

            if page_text:
                text_chunks.append(f"--- Page {page_idx + 1} ---\n{page_text}")
                
    extracted = "\n\n".join(text_chunks)
    return (extracted if extracted else "No readable content found."), total_pages

def budget_tokens(text: str, max_chars: int = 35000) -> str:
    if len(text) > max_chars:
        half = max_chars // 2
        return text[:half] + "\n\n[... truncated ...]\n\n" + text[-half:]
    return text

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return JSONResponse(content={"status": "online", "service": "DocuIQ Backend API"})

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), doc_id: str = Form(...)):
    try:
        content = await file.read()
        filename = file.filename or "document"
        
        if filename.lower().endswith(".pdf"):
            extracted_text, total_pages = extract_pdf_content(content)
        elif any(filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"]):
            extracted_text = ocr_image_with_groq(content)
            if not extracted_text:
                extracted_text = f"Visual image file: {filename}."
            total_pages = 1
        else:
            extracted_text = content.decode("utf-8", errors="ignore")
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
    system_prompt = (
        f"You are DocuIQ, an expert document intelligence assistant. Summarize the provided document in {req.language}. "
        f"Desired Length/Style: {req.length}. Structure your response cleanly using bullet points and bold key terms."
    )
    
    async def generate_stream() -> AsyncGenerator[str, None]:
        if not groq_client:
            yield "\n[Error: GROQ_API_KEY environment variable is missing on Render.]"
            return
            
        last_error = ""
        for model_name in GROQ_TEXT_MODELS:
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
    system_prompt = (
        "You are DocuIQ Copilot. Answer user questions strictly based ONLY on the provided document. "
        "If information is absent, state: 'I cannot find this information in the document.'"
    )
    
    async def generate_chat_stream() -> AsyncGenerator[str, None]:
        if not groq_client:
            yield "\n[Error: GROQ_API_KEY is missing on Render.]"
            return
            
        last_error = ""
        for model_name in GROQ_TEXT_MODELS:
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