"""
src/routes/sandboxes.py — Code Execution, Sandbox Files, Deploy & Preview Router
"""

import os
import time
import tempfile
import base64
import subprocess
import re
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import FileResponse

from src.guardrails.output_guardrail import redact_sensitive_keys
from src.guardrails.execution_guardrail import is_safe_sandbox_path
from src.guardrails.security_middleware import (
    global_rate_limiter,
    get_current_user_optional,
)
from src.utils.sandbox_manager import get_file_list, read_file, get_sandbox_path, write_file, execute_command
from src.routes.schemas import (
    RunCodeRequest,
    SaveFileRequest,
    RenameFileRequest,
    DeployRequest,
)

router = APIRouter(prefix="/api", tags=["sandboxes"])


def _sanitize_sandbox_env() -> Dict[str, str]:
    """Returns a sanitized copy of os.environ with all API keys and secrets stripped."""
    sanitized = {}
    sensitive_keywords = ["KEY", "TOKEN", "SECRET", "PASS", "AUTH", "DATABASE", "CREDENTIAL", "PASSWORD", "URL", "SUPABASE", "GEMINI", "OPENAI", "LANGSMITH", "ANTHROPIC"]
    for k, v in os.environ.items():
        k_upper = k.upper()
        if not any(kw in k_upper for kw in sensitive_keywords):
            sanitized[k] = v
    sanitized["PATH"] = os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin")
    return sanitized


@router.post("/run-code")
async def run_code(
    req: RunCodeRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    allowed, limit_msg = global_rate_limiter.check_rate_limit(user.get("id"), is_user=True, max_requests=20, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=limit_msg)

    code = req.code
    lang = req.language.lower()
    sandbox_dir = Path("./data/sandbox")
    sandbox_dir.mkdir(parents=True, exist_ok=True)
    sanitized_env = _sanitize_sandbox_env()
    
    try:
        if lang in ["python", "python3", "py"]:
            # Clear old images in sandbox to prevent stale charts
            for old_img in sandbox_dir.glob("*.png"):
                try: old_img.unlink()
                except: pass
                
            tmp_path = sandbox_dir / f"script_{int(time.time())}.py"
            with open(tmp_path, "w") as f:
                f.write(code)
            
            result = subprocess.run(
                ["python3", tmp_path.name],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=str(sandbox_dir),
                env=sanitized_env
            )
            try: os.remove(tmp_path)
            except: pass
            
            output = redact_sensitive_keys(result.stdout)
            if result.stderr:
                output += f"\n[Errors]\n{redact_sensitive_keys(result.stderr)}"
                
            # Scan for newly generated charts/images
            images = []
            for img_file in sandbox_dir.glob("*.png"):
                try:
                    with open(img_file, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode("utf-8")
                        images.append(f"data:image/png;base64,{b64}")
                    img_file.unlink()
                except Exception as e:
                    print(f"Failed to read image {img_file}: {e}")
                    
            return {"output": output.strip() or "Program executed successfully with no console output.", "images": images, "exit_code": result.returncode}
            
        elif lang in ["cpp", "c++", "c"]:
            compiler = "g++" if "cpp" in lang or "c++" in lang else "gcc"
            ext = ".cpp" if "cpp" in lang or "c++" in lang else ".c"
            tmp_src = sandbox_dir / f"main_{int(time.time())}{ext}"
            tmp_bin = sandbox_dir / f"bin_{int(time.time())}"
            
            with open(tmp_src, "w") as f:
                f.write(code)
                
            compile_res = subprocess.run(
                [compiler, "-o", tmp_bin.name, tmp_src.name],
                capture_output=True, text=True, timeout=10, cwd=str(sandbox_dir)
            )
            if compile_res.returncode != 0:
                if tmp_src.exists(): tmp_src.unlink()
                return {"output": f"[Compilation Error]\n{redact_sensitive_keys(compile_res.stderr)}", "exit_code": compile_res.returncode}
                
            run_res = subprocess.run(
                [f"./{tmp_bin.name}"], capture_output=True, text=True, timeout=10, cwd=str(sandbox_dir)
            )
            if tmp_src.exists(): tmp_src.unlink()
            if tmp_bin.exists(): tmp_bin.unlink()
            
            output = redact_sensitive_keys(run_res.stdout)
            if run_res.stderr:
                output += f"\n[Errors]\n{redact_sensitive_keys(run_res.stderr)}"
            return {"output": output.strip() or "Program executed successfully with no console output.", "exit_code": run_res.returncode}

        elif lang in ["bash", "sh", "shell", "zsh"]:
            result = subprocess.run(
                ["bash", "-c", code],
                capture_output=True, text=True, timeout=10, cwd=str(sandbox_dir), env=sanitized_env
            )
            output = redact_sensitive_keys(result.stdout)
            if result.stderr:
                output += f"\n[Errors]\n{redact_sensitive_keys(result.stderr)}"
            return {"output": output.strip() or "Script executed with no console output.", "exit_code": result.returncode}

        elif lang in ["javascript", "node", "js", "javascriptreact", "typescript"]:
            with tempfile.NamedTemporaryFile(suffix=".js", delete=False, mode="w") as f:
                f.write(code)
                tmp_path = f.name
                
            result = subprocess.run(
                ["node", tmp_path],
                capture_output=True,
                text=True,
                timeout=10,
                env=sanitized_env
            )
            os.remove(tmp_path)
            
            output = redact_sensitive_keys(result.stdout)
            if result.stderr:
                output += f"\n[Errors]\n{redact_sensitive_keys(result.stderr)}"
            return {"output": output.strip() or "Program executed with no output.", "exit_code": result.returncode}
        else:
            return {"output": f"Code preview/execution for '{lang}' format is ready. (Run via Workspace IDE for full environment execution).", "exit_code": 0}
            
    except subprocess.TimeoutExpired:
        return {"output": "Execution timed out (limit 10s).", "exit_code": 124}
    except Exception as e:
        return {"output": f"Execution failed: {str(e)}", "exit_code": 1}


@router.get("/sandboxes/{sandbox_id}/files")
def list_sandbox_files(sandbox_id: str):
    files = get_file_list(sandbox_id)
    return {"sandbox_id": sandbox_id, "files": files}


@router.post("/sandboxes/{sandbox_id}/extract")
def extract_sandbox_code(sandbox_id: str, req: Dict[str, Any]):
    markdown_text = req.get("markdown_text", "")
    if not markdown_text:
        return {"written": []}
    from src.utils.sandbox_manager import extract_and_write_code_files, reconnect_sandbox
    reconnect_sandbox(sandbox_id)
    written = extract_and_write_code_files(sandbox_id, markdown_text)
    return {"sandbox_id": sandbox_id, "files": written}


@router.get("/sandboxes/{sandbox_id}/file")
def get_sandbox_file_content(sandbox_id: str, path: str):
    content = read_file(sandbox_id, path)
    if content is None:
        raise HTTPException(status_code=404, detail="File not found in sandbox")
    return {"path": path, "content": content}


@router.post("/sandboxes/{sandbox_id}/file")
def save_sandbox_file_content(sandbox_id: str, req: SaveFileRequest):
    success = write_file(sandbox_id, req.path, req.content)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save file to sandbox")
    return {"status": "success", "path": req.path}


@router.post("/sandboxes/{sandbox_id}/rename")
def rename_sandbox_file(sandbox_id: str, req: RenameFileRequest):
    s_dir = get_sandbox_path(sandbox_id)
    if not is_safe_sandbox_path(s_dir, req.old_path) or not is_safe_sandbox_path(s_dir, req.new_path):
        raise HTTPException(status_code=403, detail="Security guardrail blocked attempt to rename outside sandbox boundary.")
    old_full = os.path.join(s_dir, req.old_path)
    new_full = os.path.join(s_dir, req.new_path)
    if os.path.exists(old_full):
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        os.rename(old_full, new_full)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")


@router.post("/sandboxes/{sandbox_id}/deploy")
def deploy_sandbox(sandbox_id: str, req: DeployRequest):
    if not req.token:
        req.token = os.getenv("VERCEL_TOKEN", "")
        if not req.token:
            raise HTTPException(status_code=400, detail="Vercel token is required")
        
    cmd = f"npx vercel deploy --prod --yes --token {req.token} --name {sandbox_id}"
    res = execute_command(sandbox_id, cmd)
    
    if res.get("exitCode", 1) != 0:
        raise HTTPException(status_code=500, detail=f"Deployment failed: {res.get('stderr', '')} {res.get('stdout', '')}")
    
    output = res.get("stdout", "") + "\n" + res.get("stderr", "")
    urls = re.findall(r'https://[a-zA-Z0-9.-]+\.vercel\.app', output)
    
    if urls:
        return {"status": "success", "url": urls[-1]}
        
    return {"status": "success", "url": "Deployment succeeded, check Vercel dashboard."}


@router.get("/sandboxes/{sandbox_id}/preview")
@router.get("/sandboxes/{sandbox_id}/preview/")
@router.get("/sandboxes/{sandbox_id}/preview/{file_path:path}")
def preview_sandbox_file(sandbox_id: str, file_path: str = "index.html"):
    if not file_path:
        file_path = "index.html"
    sandbox_path = get_sandbox_path(sandbox_id)
    if not is_safe_sandbox_path(sandbox_path, file_path):
        raise HTTPException(status_code=403, detail="Security guardrail blocked attempt to read outside sandbox boundary.")
    full_path = os.path.abspath(os.path.join(sandbox_path, file_path))
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    candidates = [
        os.path.join(sandbox_path, "index.html"),
        os.path.join(sandbox_path, "frontend", "index.html"),
        os.path.join(sandbox_path, "frontend", "public", "index.html"),
        os.path.join(sandbox_path, "public", "index.html"),
        os.path.join(sandbox_path, "backend", "public", "index.html"),
    ]
    for cand in candidates:
        if os.path.exists(cand) and os.path.isfile(cand):
            return FileResponse(cand, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

    import glob
    html_files = glob.glob(os.path.join(sandbox_path, "**/*.html"), recursive=True)
    raise HTTPException(status_code=404, detail=f"Preview file '{file_path}' not found in sandbox '{sandbox_id}'.")


@router.delete("/sandboxes/cleanup")
async def cleanup_sandboxes():
    """Deletes all generated temporary sandbox folders in ./sandboxes/ and ./data/sandbox/."""
    import shutil
    deleted_count = 0
    sandboxes_dir = Path(get_sandbox_base_dir())
    data_sandbox_dir = Path("./data/sandbox")

    if sandboxes_dir.exists():
        for p in sandboxes_dir.iterdir():
            if p.is_dir():
                try:
                    shutil.rmtree(p)
                    deleted_count += 1
                except Exception as e:
                    print(f"Error removing {p}: {e}")

    if data_sandbox_dir.exists():
        for p in data_sandbox_dir.iterdir():
            if p.is_file() and not p.name.startswith("."):
                try:
                    p.unlink()
                    deleted_count += 1
                except Exception as e:
                    print(f"Error removing {p}: {e}")

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": f"Successfully cleaned up {deleted_count} sandbox directories & temporary files."
    }

