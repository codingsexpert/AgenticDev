"""
test_api_endpoints.py — Production REST API & Integration Test Suite
"""

import pytest
from fastapi.testclient import TestClient
from server import app
from src.utils.sandbox_manager import _sanitize_sandbox_env, _truncate_output, execute_command, create_sandbox

client = TestClient(app)


def test_api_status_endpoint():
    """Verify /api/status returns online status and production security headers."""
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "online"
    
    # Verify production security headers
    headers = response.headers
    assert headers.get("x-content-type-options") == "nosniff"
    assert headers.get("x-frame-options") == "DENY"
    assert "x-process-time-ms" in headers


def test_auth_signup_and_login_flow():
    """Verify signup, password hashing, and login token issuance."""
    test_email = "test_user_prod@example.com"
    test_password = "SecurePassword123!"
    test_name = "Prod Test User"

    # Signup
    signup_resp = client.post(
        "/api/auth/signup",
        json={"email": test_email, "password": test_password, "name": test_name},
    )
    # May be 200 (created) or 400 (if already exists from previous run)
    assert signup_resp.status_code in [200, 400]

    # Login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": test_email, "password": test_password},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "token" in login_data
    assert login_data["user"]["email"] == test_email


def test_sandbox_environment_sanitization():
    """Verify sandbox subprocess environment strips sensitive keys."""
    env = _sanitize_sandbox_env()
    assert "GEMINI_API_KEY" not in env
    assert "SECRET_KEY" not in env


def test_sandbox_output_truncation():
    """Verify long output is truncated to prevent memory overflow."""
    short_text = "Hello World"
    assert _truncate_output(short_text) == short_text

    long_text = "A" * 600000  # 600 KB
    truncated = _truncate_output(long_text, max_bytes=100000)
    assert "[OUTPUT TRUNCATED" in truncated
    assert len(truncated) < 600000


def test_sandbox_command_timeout():
    """Verify command execution respects timeout bounds."""
    sb_id = create_sandbox()
    res = execute_command(sb_id, "sleep 5", timeout=500)  # 0.5 sec timeout
    assert res["exitCode"] == 124
    assert "timed out" in res["stderr"].lower()
