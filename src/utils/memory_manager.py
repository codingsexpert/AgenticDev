"""
memory_manager.py — Multi-Tier Memory System for AI Dev Team
Implements Short-Term Memory, Persistent Long-Term Memory, and User Preferences Store.
Now with Supabase integration and local JSON fallback!
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase_client = None
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client, Client
        supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Supabase Client Initialized in memory_manager.py")
    except Exception as e:
        print(f"⚠️ Failed to initialize Supabase client: {e}")

# Local Fallback Constants
MEMORY_DIR = os.path.join(os.getcwd(), "data", "memory")
LONG_TERM_FILE = os.path.join(MEMORY_DIR, "long_term_memory.json")
PREFERENCES_FILE = os.path.join(MEMORY_DIR, "user_preferences.json")
SESSION_HISTORY_DIR = os.path.join(MEMORY_DIR, "sessions")

os.makedirs(MEMORY_DIR, exist_ok=True)
os.makedirs(SESSION_HISTORY_DIR, exist_ok=True)


def _load_json(file_path: str, default: Any) -> Any:
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def _save_json(file_path: str, data: Any):
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"⚠️ Memory save error: {str(e)}")


# -----------------------------------------------------------------------------
# Tier 1: Chat Sessions & Persistent Conversation Memory
# -----------------------------------------------------------------------------

def save_session_message(thread_id: str, role: str, content: str) -> List[Dict[str, str]]:
    """Appends a message to short-term session conversation memory (Local only)."""
    session_file = os.path.join(SESSION_HISTORY_DIR, f"{thread_id}.json")
    history = _load_json(session_file, [])
    if isinstance(history, list):
        history.append({
            "role": role,
            "content": content,
            "timestamp": time.time(),
        })
        _save_json(session_file, history)
    return history if isinstance(history, list) else []


def get_session_history(thread_id: str) -> List[Dict[str, str]]:
    """Retrieves short-term conversation history for a thread."""
    session_file = os.path.join(SESSION_HISTORY_DIR, f"{thread_id}.json")
    res = _load_json(session_file, [])
    return res if isinstance(res, list) else []


def save_chat_session(thread_id: str, title: str, messages: List[Dict[str, Any]], mode: str = "chat", node_history: Optional[List[Any]] = None, user_id: Optional[str] = None):
    """Saves or updates a full chat session history file."""
    # First, save to local JSON as a fail-safe
    session_file = os.path.join(SESSION_HISTORY_DIR, f"{thread_id}.json")
    existing = _load_json(session_file, {})
    
    uid = user_id or existing.get("user_id")
    current_time = int(time.time() * 1000)

    data = {
        "thread_id": thread_id,
        "title": title,
        "mode": mode,
        "messages": messages,
        "node_history": node_history or [],
        "user_id": uid,
        "updated_at": current_time,
    }
    
    # Save local
    data_local = data.copy()
    data_local["updated_at"] = time.time()
    _save_json(session_file, data_local)

    # Attempt Supabase
    if supabase_client:
        try:
            supabase_client.table("sessions").upsert(data).execute()
        except Exception as e:
            print(f"⚠️ Supabase save_chat_session error (falling back to local): {e}")

    return data


def list_chat_sessions(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Returns a list of saved chat sessions."""
    sessions = []
    current_uid = user_id if (user_id and user_id != "guest") else None

    # Try Supabase first
    if supabase_client:
        try:
            query = supabase_client.table("sessions").select("thread_id, title, mode, user_id, updated_at, messages")
            if current_uid:
                query = query.eq("user_id", current_uid)
            elif user_id == "guest":
                query = query.is_("user_id", "null")
                
            response = query.order("updated_at", desc=True).execute()
            
            for row in response.data:
                # Add message_count manually
                msgs = row.get("messages", [])
                row["message_count"] = len(msgs) if isinstance(msgs, list) else 0
                if "messages" in row:
                    del row["messages"]
                sessions.append(row)
            return sessions
        except Exception as e:
            print(f"⚠️ Supabase list_chat_sessions error (falling back to local): {e}")

    # Local Fallback
    if os.path.exists(SESSION_HISTORY_DIR):
        for fname in os.listdir(SESSION_HISTORY_DIR):
            if fname.endswith(".json"):
                fpath = os.path.join(SESSION_HISTORY_DIR, fname)
                content = _load_json(fpath, None)
                if isinstance(content, dict) and "thread_id" in content:
                    sess_user = content.get("user_id")

                    if current_uid:
                        if sess_user != current_uid:
                            continue
                    else:
                        if sess_user and sess_user != "guest":
                            continue

                    sessions.append({
                        "thread_id": content.get("thread_id"),
                        "title": content.get("title", "Chat Session"),
                        "mode": content.get("mode", "chat"),
                        "user_id": sess_user,
                        "updated_at": content.get("updated_at", 0),
                        "message_count": len(content.get("messages", [])),
                    })
    sessions.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
    return sessions


def get_chat_session(thread_id: str) -> Optional[Dict[str, Any]]:
    """Loads full chat session by thread_id."""
    # Try Supabase first
    if supabase_client:
        try:
            response = supabase_client.table("sessions").select("*").eq("thread_id", thread_id).execute()
            if response.data and len(response.data) > 0:
                return response.data[0]
        except Exception as e:
            print(f"⚠️ Supabase get_chat_session error (falling back to local): {e}")

    # Local Fallback
    session_file = os.path.join(SESSION_HISTORY_DIR, f"{thread_id}.json")
    return _load_json(session_file, None)


def delete_chat_session(thread_id: str) -> bool:
    """Deletes a chat session file by thread_id."""
    success = False
    
    # Try Supabase first
    if supabase_client:
        try:
            supabase_client.table("sessions").delete().eq("thread_id", thread_id).execute()
            success = True
        except Exception as e:
            print(f"⚠️ Supabase delete_chat_session error: {e}")

    # Local Fallback
    session_file = os.path.join(SESSION_HISTORY_DIR, f"{thread_id}.json")
    if os.path.exists(session_file):
        try:
            os.remove(session_file)
            success = True
        except Exception as e:
            print(f"⚠️ Error deleting local chat session file {thread_id}: {e}")
            
    return success


# -----------------------------------------------------------------------------
# Tier 2: Long-Term Memory (Cross-Session Project Insights & Bug Fixes)
# -----------------------------------------------------------------------------

def save_long_term_memory(category: str, key: str, value: Any):
    """Saves a persistent insight to long-term memory."""
    # Local Save
    memory_data = _load_json(LONG_TERM_FILE, {
        "project_patterns": {},
        "architectural_blueprints": {},
        "bug_fixes": [],
        "created_projects": [],
    })

    if category not in memory_data:
        memory_data[category] = {} if isinstance(value, dict) else []

    if isinstance(memory_data[category], dict):
        memory_data[category][key] = {
            "value": value,
            "updated_at": time.time(),
        }
    elif isinstance(memory_data[category], list):
        memory_data[category].append({
            "key": key,
            "value": value,
            "timestamp": time.time(),
        })

    _save_json(LONG_TERM_FILE, memory_data)

    # Supabase Save
    if supabase_client:
        try:
            data = {
                "category": category,
                "key": key,
                "value": value,
                "timestamp": int(time.time() * 1000)
            }
            supabase_client.table("long_term_memory").upsert(data).execute()
        except Exception as e:
            print(f"⚠️ Supabase save_long_term_memory error: {e}")


def get_long_term_memory(category: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves long-term memory entries."""
    if supabase_client:
        try:
            query = supabase_client.table("long_term_memory").select("*")
            if category:
                query = query.eq("category", category)
            response = query.execute()
            
            result = {}
            if not category:
                result = {
                    "project_patterns": {},
                    "architectural_blueprints": {},
                    "bug_fixes": [],
                    "created_projects": [],
                }
            
            for row in response.data:
                cat = row["category"]
                k = row["key"]
                val = row["value"]
                
                if category:
                    result[k] = {"value": val, "updated_at": row["timestamp"]}
                else:
                    if cat not in result:
                        result[cat] = {}
                    if isinstance(result[cat], dict):
                        result[cat][k] = {"value": val, "updated_at": row["timestamp"]}
                    elif isinstance(result[cat], list):
                        result[cat].append({"key": k, "value": val, "timestamp": row["timestamp"]})
            
            if category or any(result.values()):
                return result
        except Exception as e:
            print(f"⚠️ Supabase get_long_term_memory error (falling back to local): {e}")

    # Local Fallback
    memory_data = _load_json(LONG_TERM_FILE, {
        "project_patterns": {},
        "architectural_blueprints": {},
        "bug_fixes": [],
        "created_projects": [],
    })
    if category:
        return memory_data.get(category, {})
    return memory_data


# -----------------------------------------------------------------------------
# Tier 3: User Preferences Memory (Personal Profile & Defaults)
# -----------------------------------------------------------------------------

DEFAULT_PREFERENCES = {
    "preferred_database": "supabase",
    "preferred_framework": "fastapi",
    "preferred_frontend": "html-css",
    "preferred_theme": "light",
    "language": "hinglish",
    "rate_limit_mitigation": True,
}


def get_user_preferences() -> Dict[str, Any]:
    """Gets persistent user preferences."""
    if supabase_client:
        try:
            response = supabase_client.table("user_preferences").select("preferences").eq("id", "default").execute()
            if response.data and len(response.data) > 0:
                prefs = response.data[0].get("preferences", {})
                # Merge with defaults
                merged = DEFAULT_PREFERENCES.copy()
                merged.update(prefs)
                return merged
        except Exception as e:
            print(f"⚠️ Supabase get_user_preferences error (falling back to local): {e}")

    return _load_json(PREFERENCES_FILE, DEFAULT_PREFERENCES)


def update_user_preference(key: str, value: Any) -> Dict[str, Any]:
    """Updates a specific user preference in long-term profile memory."""
    prefs = get_user_preferences()
    prefs[key] = value
    prefs["last_updated"] = time.time()
    
    # Local Save
    _save_json(PREFERENCES_FILE, prefs)

    # Supabase Save
    if supabase_client:
        try:
            data = {
                "id": "default",
                "preferences": prefs,
                "last_updated": int(time.time() * 1000)
            }
            supabase_client.table("user_preferences").upsert(data).execute()
        except Exception as e:
            print(f"⚠️ Supabase update_user_preference error: {e}")

    return prefs


# -----------------------------------------------------------------------------
# Tier 4: User Accounts & Auth Database Storage (Supabase + Local DB)
# -----------------------------------------------------------------------------

USER_STORE_FILE = os.path.join(MEMORY_DIR, "users.json")


def save_user_profile(user_obj: Dict[str, Any]) -> Dict[str, Any]:
    """Saves user account profile to local DB and Supabase if configured."""
    users = _load_json(USER_STORE_FILE, {})
    email_key = user_obj["email"].strip().lower()
    users[email_key] = user_obj
    _save_json(USER_STORE_FILE, users)

    if supabase_client:
        try:
            db_data = {
                "id": user_obj.get("id"),
                "email": email_key,
                "name": user_obj.get("name"),
                "avatar": user_obj.get("avatar"),
                "provider": user_obj.get("provider", "email"),
                "updated_at": int(time.time() * 1000)
            }
            supabase_client.table("users").upsert(db_data).execute()
        except Exception as e:
            print(f"⚠️ Supabase save_user_profile notice: {e}")

    return user_obj


def get_user_profile(email: str) -> Optional[Dict[str, Any]]:
    """Retrieves user profile by email address."""
    email_key = email.strip().lower()
    users = _load_json(USER_STORE_FILE, {})
    if email_key in users:
        return users[email_key]

    if supabase_client:
        try:
            res = supabase_client.table("users").select("*").eq("email", email_key).execute()
            if res.data and len(res.data) > 0:
                return res.data[0]
        except Exception as e:
            print(f"⚠️ Supabase get_user_profile notice: {e}")

    return None
