"""
execution_guardrail.py — Local Sandbox Safety & Command Boundary Guardrail

Ensures all file access and subprocess commands are strictly confined within
the designated sandbox workspace directory without dangerous system side effects.
"""

import os
import re
from typing import Tuple, List

BLOCKED_COMMANDS = [
    r"\brm\s+-rf\s+/",
    r"\brm\s+-rf\s+~",
    r"\bmkfs\b",
    r"\bdd\b",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\bformat\b",
    r"\bchmod\s+-R\s+777\s+/",
    r">\s*/dev/sd",
    r"\bsudo\b",
    r"\bsu\b",
    r"\buseradd\b",
    r"\busermod\b",
    r"\bcrontab\b",
    r"\blaunchctl\b",
    r"\bcurl\b.*\|\s*(?:bash|sh)\b",
    r"\bwget\b.*\|\s*(?:bash|sh)\b",
    r"\bnc\s+-e\b",
    r"\bncat\b",
    r"\bsocat\b",
    r"\bngrok\b",
    r"\bcloudflared\b",
    r"\b\w*sh\s+-i\b",
    r"~/\.ssh",
    r"/etc/shadow",
    r"/etc/passwd",
    r"/etc/hosts",
    r"\bprintenv\b",
    r"\benv\b\s*$",
    r"cat\s+.*\.env",
    r"grep\s+.*API_KEY",
]

FORBIDDEN_EXTENSIONS = {".so", ".dylib", ".dll", ".exe", ".bin"}


def is_safe_sandbox_path(sandbox_dir: str, target_path: str) -> bool:
    """
    Verifies that target_path resides safely within sandbox_dir using realpath traversal resolution.
    Prevents directory traversal (e.g. ../../etc/passwd) and symlink bypasses.
    """
    if not sandbox_dir or not target_path:
        return False

    try:
        abs_sandbox = os.path.realpath(os.path.abspath(sandbox_dir))
        joined = os.path.join(abs_sandbox, target_path)
        abs_target = os.path.realpath(os.path.abspath(joined))

        # Check path boundary
        if not (abs_target == abs_sandbox or abs_target.startswith(abs_sandbox + os.sep)):
            return False

        # Additional symlink verification
        if os.path.islink(joined):
            link_target = os.path.realpath(joined)
            if not link_target.startswith(abs_sandbox + os.sep):
                return False

        return True
    except Exception:
        return False


def is_safe_file_extension(filepath: str) -> bool:
    """Checks if the target file extension is safe for writing in sandbox."""
    ext = os.path.splitext(filepath)[1].lower()
    return ext not in FORBIDDEN_EXTENSIONS


def validate_sandbox_command(command: str, sandbox_dir: str) -> Tuple[bool, str]:
    """
    Validates a command before executing in local subprocess.
    Confines execution strictly inside sandbox and blocks unsafe patterns.
    """
    if not command or not command.strip():
        return False, "Empty command"

    cmd_str = command.strip()

    # Block destructive/elevated command patterns
    for pattern in BLOCKED_COMMANDS:
        if re.search(pattern, cmd_str, re.IGNORECASE):
            return False, f"Command blocked by safety guardrail (suspicious pattern: {pattern})"

    # Block navigation attempts out of sandbox root
    if re.search(r"\bcd\s+(\.\.|/|~)", cmd_str):
        return False, "Command blocked: Navigation outside sandbox boundary ('cd ..' / 'cd /' / 'cd ~') is strictly forbidden."

    return True, "Command passed safety check"
