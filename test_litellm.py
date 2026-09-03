import os
import httpx
from litellm import completion
from dotenv import load_dotenv

load_dotenv()
try:
    response = completion(
        model="gemini/gemini-1.5-flash",
        messages=[{"role": "user", "content": "hi"}]
    )
    print(response.choices[0].message.content)
except Exception as e:
    print("LiteLLM Error:", type(e), e)
