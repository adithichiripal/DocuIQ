import io
import os
import uuid
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image
import pypdf
import pytesseract
from google import genai
from sqlalchemy.orm import Session

from database import SessionModel, get_db

if os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

load_dotenv()

GEMINI_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None

app = FastAPI(title="DOCUIQ Backend - Persistent Database")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def extract_pdf_data(file_bytes: bytes):
    extracted_text = ""
    page_count = 0
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        page_count = len(reader.pages)
        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                extracted_text += f"\n--- Page {page_idx + 1} ---\n" + page_text
    except Exception as e:
        print(f"PDF extraction error: {e}")
    return extracted_text.strip(), max(page_count, 1)


def extract_image_data(file_bytes: bytes):
    try:
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image, config="--psm 6")
        return text.strip(), 1
    except Exception as e:
        print(f"OCR Error: {e}")
        return "", 1


class ChatRequest(BaseModel):
    session_id: str
    message: str


class SummarizeRequest(BaseModel):
    session_id: str
    summary_length: str = "medium"
    target_language: str = "English"


class DeleteDocRequest(BaseModel):
    session_id: str
    filename: str


@app.get("/api/sessions/{session_id}")
async def get_session_data(session_id: str, db: Session = Depends(get_db)):
    """Fetch existing session data on page reload"""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session.id,
        "documents": session.get_documents(),
        "summary": session.get_summary(),
        "chat_history": session.get_chat_history()
    }


@app.post("/api/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    current_session_id = session_id or str(uuid.uuid4())
    session = db.query(SessionModel).filter(SessionModel.id == current_session_id).first()

    if not session:
        session = SessionModel(id=current_session_id)
        db.add(session)
        db.commit()
        db.refresh(session)

    docs = session.get_documents()

    for file in files:
        file_bytes = await file.read()
        extracted_text = ""
        method_used = "Native PDF"
        pages = 1

        if file.filename.lower().endswith(".pdf"):
            extracted_text, pages = extract_pdf_data(file_bytes)
            if not extracted_text:
                extracted_text, _ = extract_image_data(file_bytes)
                method_used = "OCR Fallback"
        elif any(file.filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"]):
            extracted_text, pages = extract_image_data(file_bytes)
            method_used = "Tesseract OCR"
        else:
            try:
                extracted_text = file_bytes.decode("utf-8")
                method_used = "Plain Text"
            except Exception:
                extracted_text = ""

        word_count = len(extracted_text.split()) if extracted_text else 0

        docs[file.filename] = {
            "text": extracted_text,
            "method": method_used,
            "pages": pages,
            "word_count": word_count,
            "size_kb": round(len(file_bytes) / 1024, 1),
            "uploaded_at": datetime.utcnow().strftime("%H:%M:%S")
        }

    session.set_documents(docs)
    session.combined_text = "\n\n".join(
        [f"### Document: {name}\n{d['text']}" for name, d in docs.items() if d['text']]
    )
    session.last_accessed = datetime.utcnow()
    db.commit()

    return {
        "session_id": current_session_id,
        "documents": docs,
        "total_documents": len(docs)
    }


@app.post("/api/delete-doc")
async def delete_document(req: DeleteDocRequest, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == req.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    docs = session.get_documents()
    if req.filename in docs:
        del docs[req.filename]
        session.set_documents(docs)
        session.combined_text = "\n\n".join(
            [f"### Document: {name}\n{d['text']}" for name, d in docs.items() if d['text']]
        )
        db.commit()

    return {"status": "success", "documents": docs}


@app.post("/api/summarize-stream")
async def generate_summary_stream(req: SummarizeRequest, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == req.session_id).first()
    if not session or not session.combined_text.strip():
        raise HTTPException(status_code=400, detail="No readable text available in session.")

    length_guidelines = {
        "short": "Brief, ultra-concise TL;DR (3-4 bullet points maximum).",
        "medium": "Balanced executive summary (5-8 structured points).",
        "long": "Comprehensive breakdown with all key findings and next steps."
    }

    prompt = f"""
    You are an expert Document Intelligence Assistant.
    Detail Level: {length_guidelines.get(req.summary_length, length_guidelines['medium'])}
    Language: Translate and output in {req.target_language}.

    Format using clean Markdown:
    - **Executive Brief**
    - **Key Highlights** (Bullet points)
    - **Action Points & Metrics**
    Ground strictly in the provided text.

    --- DOCUMENT CONTEXT ---
    {session.combined_text[:30000]}
    """

    def token_stream():
        full_text = ""
        response = client.models.generate_content_stream(
            model="gemini-3.6-flash",
            contents=prompt
        )
        for chunk in response:
            if chunk.text:
                full_text += chunk.text
                yield chunk.text
        
        # Save summary to DB
        summary_dict = session.get_summary()
        summary_dict[req.summary_length] = full_text
        session.set_summary(summary_dict)
        db.commit()

    return StreamingResponse(token_stream(), media_type="text/plain")


@app.post("/api/chat-stream")
async def document_chat_stream(req: ChatRequest, db: Session = Depends(get_db)):
    session = db.query(SessionModel).filter(SessionModel.id == req.session_id).first()
    if not session or not session.combined_text.strip():
        raise HTTPException(status_code=400, detail="No document context found in session.")

    chat_prompt = f"""
    You are a voice-ready, concise Document Assistant.
    Answer accurately using ONLY the context provided.
    If context doesn't have it, state that directly.

    --- DOCUMENT CONTEXT ---
    {session.combined_text[:30000]}

    --- QUESTION ---
    {req.message}
    """

    def chat_token_stream():
        full_reply = ""
        response = client.models.generate_content_stream(
            model="gemini-3.6-flash",
            contents=chat_prompt
        )
        for chunk in response:
            if chunk.text:
                full_reply += chunk.text
                yield chunk.text

        history = session.get_chat_history()
        history.append({"sender": "user", "text": req.message})
        history.append({"sender": "ai", "text": full_reply})
        session.set_chat_history(history)
        db.commit()

    return StreamingResponse(chat_token_stream(), media_type="text/plain")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)