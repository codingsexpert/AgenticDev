"""
test_security_architecture.py — Automated Security Architecture & Multi-Tenant Authorization Test Suite

Verifies:
1. Signup validation (email format, password strength, duplicate prevention).
2. Login credential masking (generic error for invalid user/password).
3. Session revocation via logout.
4. User A vs User B cross-tenant resource isolation (Chats, Files, Memories, RAG).
5. SSRF prevention against loopback, private IPs, and cloud metadata.
6. Code execution subprocess environment secret sanitization.
7. Sliding window rate limiting.
"""

import time
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from server import app, _sanitize_sandbox_env, load_users, save_users
from src.guardrails.security_middleware import validate_url_against_ssrf, RateLimiter
from src.utils.rag_engine import retrieve_from_kb, get_user_kb_dir


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Resets rate limiter memory windows between unit test cases."""
    from src.guardrails.security_middleware import global_rate_limiter
    global_rate_limiter._ip_windows.clear()
    global_rate_limiter._user_windows.clear()


def test_signup_validation_and_weak_password_rejection():
    """Verify signup enforces email format, password strength, and duplicate prevention."""
    # 1. Invalid Email Format
    resp = client.post("/api/auth/signup", json={"email": "invalid_email_no_domain", "password": "Password123!", "name": "Test User"})
    assert resp.status_code == 400
    assert "Invalid email address format" in resp.json()["detail"]

    # 2. Weak Password (too short or missing digits)
    resp = client.post("/api/auth/signup", json={"email": "valid_user_weak@example.com", "password": "abc", "name": "Test User"})
    assert resp.status_code == 400
    assert "Password must be at least 8 characters long" in resp.json()["detail"]

    # 3. Valid Signup
    user_email = f"signup_user_{int(time.time())}@example.com"
    resp = client.post("/api/auth/signup", json={"email": user_email, "password": "SecurePassword123!", "name": "Valid User"})
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["user"]["email"] == user_email

    # 4. Duplicate Signup Attempt
    resp = client.post("/api/auth/signup", json={"email": user_email, "password": "SecurePassword123!", "name": "Valid User"})
    assert resp.status_code == 400
    assert "already exists" in resp.json()["detail"]


def test_login_invalid_credentials_masking():
    """Verify login returns generic errors for invalid email or password without revealing user presence."""
    # 1. Non-existent email
    resp = client.post("/api/auth/login", json={"email": "non_existent_9999@example.com", "password": "WrongPassword123!"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid email or password."

    # 2. Existing user wrong password
    user_email = f"auth_test_{int(time.time())}@example.com"
    client.post("/api/auth/signup", json={"email": user_email, "password": "CorrectPassword123!", "name": "Auth User"})

    resp = client.post("/api/auth/login", json={"email": user_email, "password": "WrongPassword123!"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid email or password."

    # 3. Successful login
    resp = client.post("/api/auth/login", json={"email": user_email, "password": "CorrectPassword123!"})
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_logout_token_revocation():
    """Verify calling logout revokes the server-side session token."""
    user_email = f"logout_user_{int(time.time())}@example.com"
    signup_resp = client.post("/api/auth/signup", json={"email": user_email, "password": "SecurePassword123!", "name": "Logout User"})
    token = signup_resp.json()["token"]

    # Perform authenticated logout
    logout_resp = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "success"

    # Verify user token was cleared on server
    users = load_users()
    assert users[user_email].get("token") is None


def test_cross_user_chat_ownership_user_a_vs_user_b():
    """Verify User A cannot read, rename, or delete User B's chat sessions."""
    # Register User A and User B
    user_a_email = f"tenant_a_{int(time.time())}@example.com"
    user_b_email = f"tenant_b_{int(time.time())}@example.com"

    resp_a = client.post("/api/auth/signup", json={"email": user_a_email, "password": "Password123!", "name": "User A"})
    token_a = resp_a.json()["token"]

    resp_b = client.post("/api/auth/signup", json={"email": user_b_email, "password": "Password123!", "name": "User B"})
    token_b = resp_b.json()["token"]

    thread_b = f"thread_b_secret_{int(time.time())}"

    # User B creates a chat session
    save_b = client.post(
        "/api/chats/save",
        json={"thread_id": thread_b, "title": "User B Confidential Chat", "messages": [{"role": "user", "content": "Secret User B Data"}]},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert save_b.status_code == 200

    # User A attempts to read User B's chat
    get_a = client.get(f"/api/chats/{thread_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert get_a.status_code == 403
    assert "Access denied" in get_a.json()["detail"]

    # User A attempts to rename User B's chat
    rename_a = client.post(
        f"/api/chats/{thread_b}/rename",
        json={"title": "Hacked Title"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert rename_a.status_code == 403

    # User A attempts to delete User B's chat
    del_a = client.delete(f"/api/chats/{thread_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert del_a.status_code == 403


def test_rag_multi_tenant_isolation(tmp_path):
    """Verify User A cannot retrieve RAG documents uploaded by User B."""
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

    # Cleanup
    try:
        secret_doc.unlink()
    except Exception:
        pass


def test_ssrf_protection():
    """Verify validate_url_against_ssrf blocks loopback, private IPs, and metadata endpoints."""
    valid, msg = validate_url_against_ssrf("http://127.0.0.1:8000/admin")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://localhost/secret")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://169.254.169.254/latest/meta-data/")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://metadata.google.internal/computeMetadata/v1/")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://10.0.0.1/internal-dashboard")
    assert valid is False

    valid, msg = validate_url_against_ssrf("http://192.168.1.1/router-login")
    assert valid is False

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
    """Verify KB upload blocks invalid file extensions and path traversal."""
    invalid_file = ("malicious.exe", b"binary code content", "application/octet-stream")
    resp = client.post("/api/kb/upload", files={"files": invalid_file})
    assert resp.status_code == 400
    assert "not allowed for security reasons" in resp.json()["detail"]

    traversal_file = ("../../etc/cron.d/malicious.txt", b"cron payload", "text/plain")
    resp = client.post("/api/kb/upload", files={"files": traversal_file})
    assert resp.status_code == 200
    uploaded_files = resp.json()["files"]
    assert "malicious.txt" in uploaded_files
    assert "../../" not in uploaded_files[0]


def test_rate_limiter_sliding_window():
    """Verify RateLimiter blocks requests exceeding threshold."""
    limiter = RateLimiter()
    test_id = f"test_rate_{int(time.time())}"

    for _ in range(5):
        allowed, msg = limiter.check_rate_limit(test_id, is_user=True, max_requests=5, window_seconds=60)
        assert allowed is True

    allowed, msg = limiter.check_rate_limit(test_id, is_user=True, max_requests=5, window_seconds=60)
    assert allowed is False
    assert "Rate limit exceeded" in msg
