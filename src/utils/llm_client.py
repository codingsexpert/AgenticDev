"""
llm_client.py — Universal Multi-LLM Client with Native Tool Calling & Web Search
Supports OpenAI, Anthropic, Gemini via LiteLLM.
"""

import os
import time
import json
import base64
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel
import litellm
from litellm import completion
from duckduckgo_search import DDGS
from src.guardrails.output_guardrail import parse_and_validate_json
from src.utils.token_tracker import calculate_gemini_cost

def search_internet(query: str, max_results: int = 3) -> str:
    """Searches the internet for information."""
    print(f"   🔍 [Web Search] Searching for: '{query}'")
    try:
        results = DDGS().text(query, max_results=max_results)
        if not results:
            return "No results found."
        formatted = []
        for r in results:
            formatted.append(f"Title: {r.get('title')}\nSnippet: {r.get('body')}\nURL: {r.get('href')}")
        return "\n\n".join(formatted)
    except Exception as e:
        return f"Search failed: {str(e)}"

search_tool = {
    "type": "function",
    "function": {
        "name": "search_internet",
        "description": "Searches the internet for current information, documentation, or code examples. Use this if you are unsure about syntax or need updated context.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query."
                }
            },
            "required": ["query"]
        }
    }
}

def call_llm(
    system_prompt: str,
    user_prompt: str,
    agent_name: str = "agent",
    current_cost: float = 0.0,
    token_budget: float = 2.0,
    schema: Optional[Type[BaseModel]] = None,
    model: Optional[str] = None,
    media_items: Optional[List[Dict[str, Any]]] = None,
    enable_web_search: bool = False,
) -> Dict[str, Any]:
    """
    Calls any LLM using LiteLLM. Supports JSON schemas and internal tool calling.
    """
    if current_cost >= token_budget:
        raise ValueError(f"TOKEN_BUDGET_EXCEEDED: Current cost (${current_cost:.4f}) exceeded budget (${token_budget:.4f})")

    target_model = model or os.getenv("LLM_MODEL", "gemini/gemini-2.0-flash")
    
    messages = [{"role": "system", "content": system_prompt}]
    
    if media_items:
        content_arr = [{"type": "text", "text": user_prompt}]
        for item in media_items:
            mime = item.get("mime_type", "")
            data = item.get("data", "")
            if isinstance(data, bytes):
                data = base64.b64encode(data).decode('utf-8')
            elif isinstance(data, str) and "," in data:
                data = data.split(",", 1)[1]
            content_arr.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{data}"}})
        messages.append({"role": "user", "content": content_arr})
    else:
        messages.append({"role": "user", "content": user_prompt})

    tools = [search_tool] if enable_web_search else None

    kwargs = {}
    if schema:
        # Ask for JSON format for broader compatibility
        kwargs["response_format"] = {"type": "json_object"}

    max_loops = 3
    for loop in range(max_loops):
        try:
            # Tell the agent to output strict JSON if schema is provided
            if schema and loop == 0:
                messages.append({"role": "user", "content": "IMPORTANT: You MUST return ONLY valid JSON matching the required schema. Do not return markdown blocks around the JSON."})

            response = completion(
                model=target_model,
                messages=messages,
                tools=tools,
                **kwargs
            )
            
            choice = response.choices[0]
            message = choice.message

            if getattr(message, "tool_calls", None):
                # Convert message to dict format for appending as per LiteLLM/OpenAI standard
                msg_dict = message.model_dump()
                messages.append(msg_dict) 
                
                for tool_call in message.tool_calls:
                    if tool_call.function.name == "search_internet":
                        try:
                            args = json.loads(tool_call.function.arguments)
                            q = args.get("query", "")
                        except:
                            q = tool_call.function.arguments
                        search_res = search_internet(q)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": "search_internet",
                            "content": search_res
                        })
                continue
            
            raw_text = message.content or "{}"
            
            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0

            parsed = parse_and_validate_json(raw_text, schema=schema)

            try:
                cost = litellm.completion_cost(completion_response=response)
            except Exception:
                cost = calculate_gemini_cost(prompt_tokens, completion_tokens)
            
            return {
                "parsed": parsed,
                "raw": raw_text,
                "tokens": {
                    "prompt": prompt_tokens,
                    "completion": completion_tokens,
                },
                "cost": cost,
            }

        except Exception as e:
            err_str = str(e)
            if any(k in err_str for k in ["429", "503", "rate limit", "quota"]):
                print(f"   ⏳ Rate limited on {target_model}. Retrying...")
                time.sleep(2)
                continue
            raise e

    raise Exception("Max tool call loops reached without final answer.")
