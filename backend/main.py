import io
import os
import sqlite3
from typing import AsyncGenerator
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
import pytesseract
from pydantic import BaseModel

# Initialize Gemini SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI(title="DocuIQ Backend", version="2.0.0")

# Allow all origins, methods, and headers for Vercel integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "docuiq.db"

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

def process_image_ocr(image_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    if img.width > 1600:
        ratio = 1600 / img.width
        img = img.resize((1600, int(img.height * ratio)), Image.Resampling.LANCZOS)
    return pytesseract.image_to_string(img, config="--psm 1 --oem 3").strip()

def process_pdf_stream(file_bytes: bytes, max_pages: int = 50) -> tuple[str, int]:
    text_chunks = []
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        total_pages = min(len(doc), max_pages)
        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_text = page.get_text().strip()
            if not page_text or len(page_text) < 30:
                pix = page.get_pixmap(dpi=150)
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                if img.width > 1600:
                    img = img.resize((1600, int(img.height * (1600 / img.width))), Image.Resampling.LANCZOS)
                page_text = pytesseract.image_to_string(img, config="--psm 1 --oem 3").strip()
            if page_text:
                text_chunks.append(f"--- Page {page_idx + 1} ---\n{page_text}")
    return "\n\n".join(text_chunks), total_pages

def budget_tokens(text: str, max_chars: int = 35000) -> str:
    if len(text) > max_chars:
        half = max_chars // 2
        return text[:half] + "\n\n[... truncated for rapid streaming ...]\n\n" + text[-half:]
    return text

# Dedicated Health Check Endpoints
@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "online", "service": "DocuIQ Backend API"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), doc_id: str = Form(...)):
    try:
        content = await file.read()
        filename = file.filename or "document"
        if filename.lower().endswith(".pdf"):
            extracted_text, total_pages = process_pdf_stream(content)
        else:
            extracted_text = process_image_ocr(content)
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
            "preview": extracted_text[:500]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    prompt = f"""
    You are DocuIQ, an expert document analyst.
    Summarize the following document in {req.language}.
    Summary Length/Style: {req.length}.
    Use clean Markdown formatting with bullet points and bold key terms.
    
    DOCUMENT CONTENT:
    {doc_text}
    """
    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as err:
            yield f"\n[Streaming Error: {str(err)}]"
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
    prompt = f"""
    Answer the user's question strictly based ONLY on the document context below.
    If the answer is not present, state clearly: "I cannot find this information in the document."
    Keep the tone direct and concise.
    
    DOCUMENT CONTEXT:
    {doc_text}
    
    QUESTION:
    {req.question}
    """
    async def generate_chat_stream() -> AsyncGenerator[str, None]:
        try:
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = model.generate_content(prompt, stream=True)
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as err:
            yield f"\n[Error: {str(err)}]"
    return StreamingResponse(generate_chat_stream(), media_type="text/plain")