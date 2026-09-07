"""
src/routes/rag.py — Knowledge Base Document Ingestion Router
"""

from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File

from src.guardrails.security_middleware import global_rate_limiter, get_current_user_optional
from src.utils.rag_engine import get_user_kb_dir

router = APIRouter(prefix="/api/kb", tags=["rag"])


@router.post("/upload")
async def kb_upload(
    files: List[UploadFile] = File(...),
    request: Request = None,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    user_kb_dir = get_user_kb_dir(user.get("id", "default_user"))
    
    if request:
        allowed, limit_msg = global_rate_limiter.check_rate_limit(user.get("id"), is_user=True, max_requests=10, window_seconds=60)
        if not allowed:
            raise HTTPException(status_code=429, detail=limit_msg)

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit
    ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx", ".csv", ".json", ".md", ".py", ".js", ".ts", ".css", ".html"}

    saved_files = []
    for file in files:
        safe_filename = Path(file.filename).name
        ext = Path(safe_filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed for security reasons.")
            
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{safe_filename}' exceeds maximum allowed size of 10MB.")

        file_path = user_kb_dir / safe_filename
        with open(file_path, "wb") as f:
            f.write(content)
        saved_files.append(safe_filename)
        
    return {"status": "success", "message": f"Uploaded {len(saved_files)} files to Knowledge Base.", "files": saved_files}


@router.get("/files")
def list_kb_files(user: Dict[str, Any] = Depends(get_current_user_optional)):
    user_kb_dir = get_user_kb_dir(user.get("id", "default_user"))
    if not user_kb_dir.exists():
        return {"files": []}
    files = []
    for f in user_kb_dir.iterdir():
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size": stat.st_size,
                "modified": stat.st_mtime
            })
    return {"files": files}


@router.delete("/files/{filename}")
def delete_kb_file(filename: str, user: Dict[str, Any] = Depends(get_current_user_optional)):
    safe_name = Path(filename).name
    user_kb_dir = get_user_kb_dir(user.get("id", "default_user"))
    file_path = user_kb_dir / safe_name
    if file_path.exists() and file_path.is_file():
        file_path.unlink()
        return {"status": "success", "message": f"Deleted {safe_name} from Knowledge Base."}
    raise HTTPException(status_code=404, detail="File not found in Knowledge Base.")
