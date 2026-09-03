import os
from dotenv import load_dotenv
load_dotenv()
from src.utils.llm_client import call_llm
from src.guardrails.output_guardrail import PMSpecModel
try:
    print("Calling LLM...")
    res = call_llm(
        system_prompt="You are a PM",
        user_prompt="Build simple todo list using html css javascript",
        schema=PMSpecModel
    )
    print("Result:", res)
except Exception as e:
    print("Error:", e)
