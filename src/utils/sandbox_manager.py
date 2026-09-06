"""
sandbox_manager.py — Local Filesystem & Subprocess Sandbox Manager (Docker-Free)

Manages isolated workspace environments in ./sandboxes/sandbox-<timestamp>
Handles file operations, local process execution, and Git snapshots.
"""

import os
import re
import shutil
import secrets
import subprocess
import resource
from typing import Dict, Any, List, Optional
from src.guardrails.execution_guardrail import is_safe_sandbox_path, validate_sandbox_command, is_safe_file_extension
from src.guardrails.output_guardrail import redact_sensitive_keys

_sandboxes: Dict[str, Dict[str, Any]] = {}


def get_sandbox_base_dir() -> str:
    return os.getenv("SANDBOX_DIR", os.path.join(os.cwd() if hasattr(os, "cwd") else os.getcwd(), "sandboxes"))


def scaffold_folder_structure(sandbox_path: str, folder_structure: Any):
    """
    Parses any folder structure representation (tree diagram, slash paths, bullet lists)
    and recursively creates all physical directories on disk.
    """
    if not folder_structure:
        return

    lines = []
    if isinstance(folder_structure, str):
        lines = folder_structure.splitlines()
    elif isinstance(folder_structure, list):
        lines = [str(item) for item in folder_structure]

    for line in lines:
        cleaned = line.strip()
        if not cleaned:
            continue
        cleaned = re.sub(r'^[│├└──\-*\s+]+', '', cleaned).strip()
        if '#' in cleaned:
            cleaned = cleaned.split('#')[0].strip()

        if cleaned:
            path_part = cleaned.rstrip('/')
            if '.' in os.path.basename(path_part):
                dir_to_make = os.path.dirname(path_part)
            else:
                dir_to_make = path_part

            if dir_to_make and len(dir_to_make) < 150:
                try:
                    full_dir = os.path.abspath(os.path.join(sandbox_path, dir_to_make))
                    if is_safe_sandbox_path(sandbox_path, dir_to_make):
                        os.makedirs(full_dir, exist_ok=True)
                except Exception:
                    pass


def create_sandbox(
    folder_structure: Any = None,
    dependencies: Optional[Dict[str, Any]] = None,
    db_schema: Optional[Dict[str, Any]] = None
) -> str:
    sandbox_id = f"sandbox-{secrets.token_hex(6)}"
    sandbox_base = get_sandbox_base_dir()
    sandbox_path = os.path.abspath(os.path.join(sandbox_base, sandbox_id))

    os.makedirs(sandbox_path, exist_ok=True)

    # Parse & scaffold custom folder structure recursively on disk
    if folder_structure:
        scaffold_folder_structure(sandbox_path, folder_structure)

    # Write dynamic package / dependency files if backend/frontend exist
    deps = dependencies or {}
    if "backend" in deps:
        b_deps = deps["backend"]
        backend_path = os.path.join(sandbox_path, "backend")
        os.makedirs(backend_path, exist_ok=True)
        import json
        with open(os.path.join(backend_path, "package.json"), "w", encoding="utf-8") as f:
            json.dump({
                "name": b_deps.get("name", "backend"),
                "version": "1.0.0",
                "type": "module",
                "main": "src/index.js",
                "scripts": {"start": "node src/index.js", "dev": "nodemon src/index.js"},
                "dependencies": b_deps.get("dependencies", {}),
                "devDependencies": b_deps.get("devDependencies", {}),
            }, f, indent=2)

    if "frontend" in deps:
        f_deps = deps["frontend"]
        frontend_path = os.path.join(sandbox_path, "frontend")
        os.makedirs(frontend_path, exist_ok=True)
        import json
        with open(os.path.join(frontend_path, "package.json"), "w", encoding="utf-8") as f:
            json.dump({
                "name": f_deps.get("name", "frontend"),
                "version": "1.0.0",
                "type": "module",
                "scripts": {"dev": "vite", "build": "vite build", "preview": "vite preview"},
                "dependencies": f_deps.get("dependencies", {}),
                "devDependencies": f_deps.get("devDependencies", {}),
            }, f, indent=2)

    # Dynamic environment secrets (no hardcoded secrets)
    jwt_secret = os.getenv("JWT_SECRET") or secrets.token_hex(32)
    db_url = os.getenv("DATABASE_URL") or "sqlite:///app.db"
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")

    if os.path.exists(os.path.join(sandbox_path, "backend")):
        with open(os.path.join(sandbox_path, "backend", ".env"), "w", encoding="utf-8") as f:
            f.write(f"PORT=5000\nDATABASE_URL={db_url}\nJWT_SECRET={jwt_secret}\nSUPABASE_URL={supabase_url}\nSUPABASE_KEY={supabase_key}\nNODE_ENV=development\n")

    if os.path.exists(os.path.join(sandbox_path, "frontend")):
        with open(os.path.join(sandbox_path, "frontend", ".env"), "w", encoding="utf-8") as f:
            f.write(f"VITE_API_URL=http://localhost:5000/api\nVITE_SUPABASE_URL={supabase_url}\nVITE_SUPABASE_ANON_KEY={supabase_key}\n")

    # Initialize local Git repository for snapshots
    try:
        subprocess.run(["git", "init"], cwd=sandbox_path, capture_output=True, check=True)
        subprocess.run(["git", "add", "-A"], cwd=sandbox_path, capture_output=True, check=True)
        subprocess.run(["git", "commit", "-m", "Initial scaffold", "--allow-empty"], cwd=sandbox_path, capture_output=True, check=True)
        subprocess.run(["git", "tag", "v0.0.0"], cwd=sandbox_path, capture_output=True, check=True)
    except Exception as e:
        print(f"⚠️ Git init warning: {str(e)}")

    _sandboxes[sandbox_id] = {
        "id": sandbox_id,
        "path": sandbox_path,
        "dockerEnabled": False,
        "healthy": True,
    }

    return sandbox_id


def get_sandbox_path(sandbox_id: str) -> str:
    if sandbox_id in _sandboxes:
        return _sandboxes[sandbox_id]["path"]
    sandbox_base = get_sandbox_base_dir()
    return os.path.abspath(os.path.join(sandbox_base, sandbox_id))


def write_file(sandbox_id: str, relative_path: str, content: str) -> bool:
    sandbox_path = get_sandbox_path(sandbox_id)
    if not is_safe_sandbox_path(sandbox_path, relative_path):
        raise ValueError(f"Security guardrail blocked attempt to write outside sandbox: {relative_path}")

    if not is_safe_file_extension(relative_path):
        raise ValueError(f"Security guardrail blocked attempt to write unsafe binary file extension: {relative_path}")

    sanitized_content = redact_sensitive_keys(content)

    full_path = os.path.abspath(os.path.join(sandbox_path, relative_path))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(sanitized_content)
    return True


def read_file(sandbox_id: str, relative_path: str) -> Optional[str]:
    sandbox_path = get_sandbox_path(sandbox_id)
    if not is_safe_sandbox_path(sandbox_path, relative_path):
        raise ValueError(f"Security guardrail blocked attempt to read outside sandbox: {relative_path}")

    full_path = os.path.abspath(os.path.join(sandbox_path, relative_path))
    if not os.path.exists(full_path):
        return None

    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()


def get_file_list(sandbox_id: str) -> List[str]:
    sandbox_path = get_sandbox_path(sandbox_id)
    if not os.path.exists(sandbox_path):
        return []

    file_list = []
    ignored_dirs = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}

    for root, dirs, files in os.walk(sandbox_path):
        dirs[:] = [d for d in dirs if d not in ignored_dirs]
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, sandbox_path)
            file_list.append(rel_path)

    return sorted(file_list)


MAX_OUTPUT_BYTES = 500 * 1024  # 500 KB limit to prevent memory bloat


def _sanitize_sandbox_env() -> Dict[str, str]:
    """Prepares a sanitized environment copy for child subprocess execution."""
    sanitized = {}
    sensitive_keywords = ["KEY", "TOKEN", "SECRET", "PASS", "AUTH", "DATABASE", "CREDENTIAL", "PASSWORD", "URL", "SUPABASE", "GEMINI", "OPENAI", "LANGSMITH", "ANTHROPIC"]
    for k, v in os.environ.items():
        k_upper = k.upper()
        if not any(kw in k_upper for kw in sensitive_keywords):
            sanitized[k] = v
    sanitized["PATH"] = os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin")
    return sanitized


def _truncate_output(text: str, max_bytes: int = MAX_OUTPUT_BYTES) -> str:
    """Truncates excessive output bytes gracefully."""
    if not text:
        return ""
    encoded = text.encode("utf-8", errors="ignore")
    if len(encoded) > max_bytes:
        half = max_bytes // 2
        return text[:half] + f"\n\n... [OUTPUT TRUNCATED ({len(text)} chars exceeding {max_bytes} bytes limit)] ...\n\n" + text[-10000:]
    return text


def execute_command(sandbox_id: str, command: str, timeout: int = 30000) -> Dict[str, Any]:
    sandbox_path = get_sandbox_path(sandbox_id)
    is_safe, msg = validate_sandbox_command(command, sandbox_path)
    if not is_safe:
        return {"stdout": "", "stderr": msg, "exitCode": 1}

    sanitized_env = _sanitize_sandbox_env()
    
    use_docker = os.getenv("USE_DOCKER_SANDBOX", "false").lower() == "true"
    
    if use_docker:
        memory_limit = os.getenv("SANDBOX_MEMORY_LIMIT", "512m")
        cpu_limit = os.getenv("SANDBOX_CPU_LIMIT", "1.0")
        escaped_cmd = command.replace('"', '\\"')
        exec_cmd = (
            f'docker run --rm -v "{sandbox_path}:/sandbox" -w /sandbox '
            f'--memory="{memory_limit}" --cpus="{cpu_limit}" '
            f'python:3.10-slim sh -c "{escaped_cmd}"'
        )
        cwd = None
    else:
        exec_cmd = command
        cwd = sandbox_path
        def limit_memory():
            try:
                memory_limit_mb = int(os.getenv("SANDBOX_MEMORY_LIMIT", "512").replace("m", ""))
                limit_bytes = memory_limit_mb * 1024 * 1024
                resource.setrlimit(resource.RLIMIT_AS, (limit_bytes, limit_bytes))
            except Exception:
                pass
        preexec_fn = limit_memory

    try:
        proc = subprocess.run(
            exec_cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            env=sanitized_env,
            timeout=timeout / 1000.0,
            preexec_fn=preexec_fn if not use_docker else None,
        )
        return {
            "stdout": _truncate_output(proc.stdout or ""),
            "stderr": _truncate_output(proc.stderr or ""),
            "exitCode": proc.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out", "exitCode": 124}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "exitCode": 1}


def rollback(sandbox_id: str, git_tag: str) -> Dict[str, Any]:
    sandbox_path = get_sandbox_path(sandbox_id)
    try:
        subprocess.run(["git", "reset", "--hard", git_tag], cwd=sandbox_path, capture_output=True, check=True)
        subprocess.run(["git", "clean", "-fd"], cwd=sandbox_path, capture_output=True, check=True)
        return {"success": True, "message": f"Rolled back to {git_tag}"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def reconnect_sandbox(sandbox_id: str) -> bool:
    sandbox_path = get_sandbox_path(sandbox_id)
    if os.path.exists(sandbox_path):
        _sandboxes[sandbox_id] = {
            "id": sandbox_id,
            "path": sandbox_path,
            "dockerEnabled": False,
            "healthy": True,
        }
        return True
    return False


def get_sandbox_info(sandbox_id: str) -> Optional[Dict[str, Any]]:
    if sandbox_id in _sandboxes:
        return _sandboxes[sandbox_id]
    sandbox_path = get_sandbox_path(sandbox_id)
    if os.path.exists(sandbox_path):
        info = {"id": sandbox_id, "path": sandbox_path, "dockerEnabled": False, "healthy": True}
        _sandboxes[sandbox_id] = info
        return info
    return None


def extract_and_write_code_files(sandbox_id: str, markdown_text: str) -> List[Dict[str, Any]]:
    """
    Parses code blocks containing file path metadata (e.g. ```python file="src/server.py" or // File: src/main.py)
    and automatically writes those files and creates parent folders physically on disk.
    If no explicit file annotations exist, infers sensible default paths (index.html, style.css, script.js, main.py).
    """
    if not sandbox_id or not markdown_text:
        return []

    written_files = []

    # Pattern 1: ```python file="app.py"
    p1 = r'```[\w\-]*\s+(?:file|path)=["\']?([^\n"\'\s]+)["\']?\n(.*?)```'
    for rel_path, content in re.findall(p1, markdown_text, re.DOTALL):
        rel_path = rel_path.strip().lstrip("./")
        if rel_path:
            try:
                write_file(sandbox_id, rel_path, content.strip())
                written_files.append({"path": rel_path, "bytes": len(content), "content": content.strip()})
            except Exception:
                pass

    # Pattern 2: ```html\n<!-- File: index.html -->
    p2 = r'```[\w\-]*\n\s*(?://|#|/\*|<!--)\s*(?:File|Path):\s*([^\n\s]+?)(?:\s*\*/|\s*-->)?\n(.*?)```'
    for rel_path, content in re.findall(p2, markdown_text, re.DOTALL):
        rel_path = rel_path.strip().lstrip("./")
        if rel_path and not any(f["path"] == rel_path for f in written_files):
            try:
                write_file(sandbox_id, rel_path, content.strip())
                written_files.append({"path": rel_path, "bytes": len(content), "content": content.strip()})
            except Exception:
                pass

    # Pattern 3: Fallback inference for unannotated code blocks (```html, ```css, ```js, ```python)
    p3 = r'```([\w\-]+)\n(.*?)```'
    idx = 1
    for lang, content in re.findall(p3, markdown_text, re.DOTALL):
        lang_clean = lang.strip().lower()
        content_clean = content.strip()
        if not content_clean or lang_clean in ["json", "bash", "sh", "text", "console"]:
            continue

        # Skip if content already written
        if any(f.get("content") == content_clean for f in written_files):
            continue

        inferred_path = None
        if lang_clean in ["html"]:
            inferred_path = "index.html" if not any(f["path"] == "index.html" for f in written_files) else f"index_{idx}.html"
        elif lang_clean in ["css"]:
            inferred_path = "style.css" if not any(f["path"] == "style.css" for f in written_files) else f"style_{idx}.css"
        elif lang_clean in ["javascript", "js", "jsx"]:
            inferred_path = "script.js" if not any(f["path"] == "script.js" for f in written_files) else f"script_{idx}.js"
        elif lang_clean in ["python", "py"]:
            inferred_path = "main.py" if not any(f["path"] == "main.py" for f in written_files) else f"main_{idx}.py"

        if inferred_path and not any(f["path"] == inferred_path for f in written_files):
            try:
                write_file(sandbox_id, inferred_path, content_clean)
                written_files.append({"path": inferred_path, "bytes": len(content_clean), "content": content_clean})
                idx += 1
            except Exception:
                pass

    # Clean out internal 'content' key before returning
    for f in written_files:
        f.pop("content", None)

    return written_files
