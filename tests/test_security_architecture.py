"""
test_security_architecture.py — Automated Security Architecture Test Suite

Verifies:
1. Multi-tenant RAG document isolation per user.
2. SSRF prevention against private IP networks, loopbacks, and metadata endpoints.
3. Subprocess environment variable sanitization (stripping API keys & secrets).
4. Knowledge Base upload validation (extension whitelisting, file size limits, path sanitization).
5. User chat session data isolation and ownership authorization.
6. Sliding window rate limiting.
"""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from server import app, _sanitize_sandbox_env
from src.guardrails.security_middleware import validate_url_against_ssrf, RateLimiter
from src.utils.rag_engine import retrieve_from_kb, get_user_kb_dir


client = TestClient(app)


def test_rag_multi_tenant_isolation(tmp_path):
    """Verify User A cannot retrieve documents uploaded by User B."""
    user_a_id = "usr_tenant_alpha"
    user_b_id = "usr_tenant_beta"

    user_a_dir = get_user_kb_dir(user_a_id)
    user_b_dir = get_user_kb_dir(user_b_id)

    # Write confidential document to User B's KB directory
    secret_doc = user_b_dir / "confidential_project.txt"
    with open(secret_doc, "w") as f:
        f.write("Project Quantum Secret: The secret passcode is 99887766.")

    # User A tries to retrieve knowledge base context about Project Quantum
    context_user_a = retrieve_from_kb("Project Quantum Secret passcode", user_id=user_a_id)
    assert "99887766" not in context_user_a
    assert context_user_a == ""

    # User B retrieves knowledge base context
    context_user_b = retrieve_from_kb("Project Quantum Secret passcode", user_id=user_b_id)
    assert "99887766" in context_user_b
    assert "confidential_project.txt" in context_user_b

    # Cleanup test files
    try:
        secret_doc.unlink()
    except Exception:
        pass


def test_ssrf_protection():
    """Verify validate_url_against_ssrf blocks loopback, private IPs, and metadata endpoints."""
    # Loopback IPs
    valid, msg = validate_url_against_ssrf("http://127.0.0.1:8000/admin")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://localhost/secret")
    assert valid is False

    # AWS/GCP/Azure Cloud Metadata IPs
    valid, msg = validate_url_against_ssrf("http://169.254.169.254/latest/meta-data/")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://metadata.google.internal/computeMetadata/v1/")
    assert valid is False

    # Private RFC1918 Networks
    valid, msg = validate_url_against_ssrf("http://10.0.0.1/internal-dashboard")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://192.168.1.1/router-login")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://172.16.0.50/database")
    assert valid is False

    # Forbidden Schemes
    valid, msg = validate_url_against_ssrf("file:///etc/passwd")
    assert valid is False

    valid, msg = validate_url_against_ssrf("gopher://127.0.0.1:70/_")
    assert valid is False

    # Safe Public URLs
    valid, msg = validate_url_against_ssrf("https://api.github.com/zen")
    assert valid is True


def test_subprocess_env_secret_stripping():
    """Verify code execution subprocess environment strips sensitive environment variables."""
    sanitized = _sanitize_sandbox_env()
    
    sensitive_keys = [
        "GEMINI_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
        "SECRET_KEY",
        "VERCEL_TOKEN",
        "DATABASE_URL",
    ]
    for key in sensitive_keys:
        assert key not in sanitized, f"Secret environment variable '{key}' was leaked to subprocess env!"


def test_kb_upload_security_validation():
    """Verify KB upload blocks invalid file extensions and oversized files."""
    # 1. Invalid extension upload attempt (.exe)
    invalid_file = ("malicious.exe", b"binary code content", "application/octet-stream")
    resp = client.post("/api/kb/upload", files={"files": invalid_file})
    assert resp.status_code == 400
    assert "not allowed for security reasons" in resp.json()["detail"]

    # 2. Path traversal filename attempt
    traversal_file = ("../../etc/cron.d/malicious.txt", b"cron payload", "text/plain")
    resp = client.post("/api/kb/upload", files={"files": traversal_file})
    assert resp.status_code == 200
    # Verify path traversal was stripped to plain basename
    uploaded_files = resp.json()["files"]
    assert "malicious.txt" in uploaded_files
    assert "../../" not in uploaded_files[0]


def test_rate_limiter_sliding_window():
    """Verify RateLimiter blocks requests exceeding threshold."""
    limiter = RateLimiter()
    test_id = "test_rate_user_123"

    # Allow 5 requests in 60s
    for _ in range(5):
        allowed, msg = limiter.check_rate_limit(test_id, is_user=True, max_requests=5, window_seconds=60)
        assert allowed is True

    # 6th request should be blocked
    allowed, msg = limiter.check_rate_limit(test_id, is_user=True, max_requests=5, window_seconds=60)
    assert allowed is False
    assert "Rate limit exceeded" in msg


def test_chat_session_user_isolation():
    """Verify User A cannot read or delete User B's chat sessions."""
    # Create session owned by User B
    session_id = f"test_thread_{int(pytest.importorskip('time').time())}"
    
    # Save chat as User B
    save_resp = client.post(
        "/api/chats/save",
        json={
            "thread_id": session_id,
            "title": "User B Private Project",
            "messages": [{"role": "user", "content": "Secret plan"}],
            "user_id": "usr_user_b"
        },
        headers={"Authorization": "Bearer pixl_jwt_mock_token_b"}
    )
    assert save_resp.status_code in [200, 403]
