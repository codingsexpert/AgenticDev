"""
src/routes/auth.py — User Authentication & Profile API Router
"""

import time
import json
import secrets
import hashlib
import re
from pathlib import Path
from typing import Dict, Any, Tuple
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse

from src.guardrails.security_middleware import (
    global_rate_limiter,
    get_client_ip,
    get_current_user_optional,
)
from src.utils.memory_manager import save_user_profile
from src.routes.schemas import (
    AuthSignUpRequest,
    AuthLoginRequest,
    GoogleAuthRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

USER_STORE_FILE = Path("./data/memory/users.json")
TOKEN_TTL_SECONDS = 86400  # 24 hours session expiration


def validate_email_format(email: str) -> bool:
    """Validates email format RFC compliance."""
    if not email or not isinstance(email, str):
        return False
    return bool(re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email.strip()))


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validates password strength rules."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isalpha() for c in password):
        return False, "Password must contain at least one letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    return True, "Valid password"


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()


def load_users():
    if USER_STORE_FILE.exists():
        try:
            with open(USER_STORE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_users(users_dict):
    USER_STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(USER_STORE_FILE, "w") as f:
        json.dump(users_dict, f, indent=2)


@router.post("/signup")
def auth_signup(req: AuthSignUpRequest, request: Request):
    client_ip = get_client_ip(request)
    allowed, limit_msg = global_rate_limiter.check_rate_limit(client_ip, is_user=False, max_requests=10, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=limit_msg)

    # 1. Email Format Validation
    if not validate_email_format(req.email):
        raise HTTPException(status_code=400, detail="Invalid email address format.")

    # 2. Password Strength Validation
    valid_pwd, pwd_err = validate_password_strength(req.password)
    if not valid_pwd:
        raise HTTPException(status_code=400, detail=pwd_err)

    users = load_users()
    email_key = req.email.strip().lower()
    if email_key in users:
        raise HTTPException(status_code=400, detail="Account with this email already exists.")
    
    salt = secrets.token_hex(16)
    pwd_hash = hash_password(req.password, salt)
    session_token = f"pixl_jwt_{secrets.token_hex(32)}"
    expires_at = time.time() + TOKEN_TTL_SECONDS
    
    user_obj = {
        "id": f"usr_{int(time.time()*1000)}",
        "name": req.name.strip(),
        "email": email_key,
        "salt": salt,
        "password_hash": pwd_hash,
        "token": session_token,
        "token_expires_at": expires_at,
        "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={req.name.strip()}",
        "token_budget": 5.0,
        "total_cost": 0.0,
        "created_at": time.time(),
    }
    users[email_key] = user_obj
    save_users(users)
    save_user_profile(user_obj)
    
    user_data = {
        "id": user_obj["id"],
        "name": user_obj["name"],
        "email": user_obj["email"],
        "avatar": user_obj["avatar"],
        "token": session_token,
        "expires_at": expires_at,
        "token_budget": user_obj.get("token_budget", 5.0),
        "total_cost": user_obj.get("total_cost", 0.0),
        "created_at": user_obj["created_at"]
    }
    return {"message": "Account created successfully", "user": user_data, "token": session_token}


@router.post("/login")
def auth_login(req: AuthLoginRequest, request: Request):
    client_ip = get_client_ip(request)
    allowed, limit_msg = global_rate_limiter.check_rate_limit(client_ip, is_user=False, max_requests=10, window_seconds=60)
    if not allowed:
        raise HTTPException(status_code=429, detail=limit_msg)

    if not req.email or not req.password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    users = load_users()
    email_key = req.email.strip().lower()
    user_obj = users.get(email_key)
    
    if not user_obj:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    pwd_hash = hash_password(req.password, user_obj["salt"])
    if pwd_hash != user_obj["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    
    session_token = f"pixl_jwt_{secrets.token_hex(32)}"
    expires_at = time.time() + TOKEN_TTL_SECONDS
    user_obj["token"] = session_token
    user_obj["token_expires_at"] = expires_at
    users[email_key] = user_obj
    save_users(users)
    save_user_profile(user_obj)
    
    user_data = {
        "id": user_obj["id"],
        "name": user_obj["name"],
        "email": user_obj["email"],
        "avatar": user_obj["avatar"],
        "token": session_token,
        "expires_at": expires_at,
        "token_budget": user_obj.get("token_budget", 5.0),
        "total_cost": user_obj.get("total_cost", 0.0),
        "created_at": user_obj.get("created_at", time.time())
    }
    return {"message": "Logged in successfully", "user": user_data, "token": session_token}


@router.post("/logout")
def auth_logout(
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user_optional)
):
    client_ip = get_client_ip(request)
    global_rate_limiter.check_rate_limit(client_ip, is_user=False, max_requests=20, window_seconds=60)
    
    if user.get("authenticated"):
        users = load_users()
        email_key = user.get("email", "").lower()
        if email_key in users:
            users[email_key].pop("token", None)
            users[email_key].pop("token_expires_at", None)
            save_users(users)
            save_user_profile(users[email_key])
            
    response = JSONResponse(content={"status": "success", "message": "Logged out successfully."})
    response.delete_cookie("session_token")
    return response


@router.post("/google")
def auth_google(req: GoogleAuthRequest):
    users = load_users()
    email_key = req.email.strip().lower()
    
    if not email_key or "@" not in email_key:
        raise HTTPException(status_code=400, detail="Invalid Gmail / Email address provided.")
        
    user_obj = users.get(email_key)
    session_token = f"pixl_jwt_{secrets.token_hex(32)}"
    
    if not user_obj:
        user_name = req.name.strip() if (req.name and req.name.strip()) else email_key.split("@")[0].replace(".", " ").title()
        user_obj = {
            "id": f"usr_google_{secrets.token_hex(8)}",
            "name": user_name,
            "email": email_key,
            "provider": "google",
            "token": session_token,
            "avatar": req.avatar or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_name}",
            "token_budget": 5.0,
            "total_cost": 0.0,
            "created_at": time.time(),
        }
        users[email_key] = user_obj
    else:
        user_obj["token"] = session_token
        users[email_key] = user_obj
        
    save_users(users)
    save_user_profile(user_obj)
    
    user_data = {
        "id": user_obj["id"],
        "name": user_obj["name"],
        "email": user_obj["email"],
        "avatar": user_obj["avatar"],
        "provider": "google",
        "token": session_token,
        "token_budget": user_obj.get("token_budget", 5.0),
        "total_cost": user_obj.get("total_cost", 0.0),
        "created_at": user_obj.get("created_at", time.time())
    }
    return {"message": "Google authentication successful", "user": user_data, "token": session_token}


@router.post("/forgot-password")
def auth_forgot_password(req: ForgotPasswordRequest):
    email_key = req.email.strip().lower()
    if not email_key or "@" not in email_key:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    
    users = load_users()
    user_obj = users.get(email_key)
    
    reset_token = f"rst_{secrets.token_hex(16)}"
    if user_obj:
        user_obj["reset_token"] = reset_token
        user_obj["reset_token_expires"] = time.time() + 3600
        users[email_key] = user_obj
        save_users(users)
        save_user_profile(user_obj)
        
    return {
        "status": "success",
        "message": f"Password reset instructions have been generated for {email_key}.",
        "reset_token": reset_token if user_obj else None
    }


@router.post("/reset-password")
def auth_reset_password(req: ResetPasswordRequest):
    email_key = req.email.strip().lower()
    users = load_users()
    user_obj = users.get(email_key)
    
    if not user_obj:
        raise HTTPException(status_code=404, detail="User account not found.")
        
    if user_obj.get("reset_token") != req.reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        
    if time.time() > user_obj.get("reset_token_expires", 0):
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")
        
    if len(req.new_password.strip()) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")
        
    salt = secrets.token_hex(16)
    user_obj["salt"] = salt
    user_obj["password_hash"] = hash_password(req.new_password, salt)
    user_obj.pop("reset_token", None)
    user_obj.pop("reset_token_expires", None)
    
    users[email_key] = user_obj
    save_users(users)
    save_user_profile(user_obj)
    
    return {"status": "success", "message": "Password has been successfully reset. You can now login with your new password."}


@router.get("/me")
def auth_me(user: Dict[str, Any] = Depends(get_current_user_optional)):
    if not user.get("authenticated"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    users = load_users()
    email_key = user.get("email", "").lower()
    user_obj = users.get(email_key)
    
    if not user_obj:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "status": "success",
        "user": {
            "id": user_obj.get("id"),
            "name": user_obj.get("name"),
            "email": user_obj.get("email"),
            "avatar": user_obj.get("avatar"),
            "token_budget": user_obj.get("token_budget", 5.0),
            "total_cost": user_obj.get("total_cost", 0.0),
            "created_at": user_obj.get("created_at")
        }
    }
