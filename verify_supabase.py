import sys
import os

# Add current directory to path so we can import src
sys.path.append(os.getcwd())

from src.utils.memory_manager import save_chat_session, get_chat_session, delete_chat_session

def test_supabase():
    print("Testing Supabase Integration...")
    
    thread_id = "test_supabase_12345"
    title = "Supabase Test Session"
    messages = [{"role": "user", "content": "Hello Supabase!"}]
    
    print("\n1. Saving a test session to Supabase...")
    save_chat_session(thread_id, title, messages)
    
    print("\n2. Fetching the test session from Supabase...")
    session = get_chat_session(thread_id)
    
    if session:
        print("✅ Success! Found session in database:")
        print(f"Title: {session.get('title')}")
        print(f"Messages: {session.get('messages')}")
    else:
        print("❌ Failed! Could not retrieve the session from the database.")
        sys.exit(1)
        
    print("\n3. Cleaning up test data...")
    success = delete_chat_session(thread_id)
    if success:
        print("✅ Cleanup successful!")
    else:
        print("⚠️ Cleanup failed, but insert/read worked.")

if __name__ == "__main__":
    test_supabase()
