import os
from litellm import completion
from dotenv import load_dotenv

load_dotenv()
models_to_test = ["gemini/gemini-1.5-flash-latest", "gemini/gemini-2.0-flash-exp", "gemini/gemini-2.0-flash", "gemini/gemini-1.5-flash-001", "gemini/gemini-1.5-flash-002"]

for m in models_to_test:
    try:
        response = completion(
            model=m,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"SUCCESS: {m}")
    except Exception as e:
        print(f"FAILED {m}: {e}")
