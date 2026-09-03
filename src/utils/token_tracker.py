"""
token_tracker.py — Token Usage & Cost Estimator for Gemini API Calls
"""

from typing import Dict, Any, List

# Pricing per 1M tokens for Gemini Flash models (USD)
COST_PER_1M_INPUT = 0.075
COST_PER_1M_OUTPUT = 0.30


def calculate_gemini_cost(prompt_tokens: int, completion_tokens: int) -> float:
    input_cost = (prompt_tokens / 1_000_000) * COST_PER_1M_INPUT
    output_cost = (completion_tokens / 1_000_000) * COST_PER_1M_OUTPUT
    return round(input_cost + output_cost, 6)


def make_token_delta(agent_name: str, tokens: Dict[str, int]) -> Dict[str, Any]:
    prompt = tokens.get("prompt", 0)
    completion = tokens.get("completion", 0)
    cost = calculate_gemini_cost(prompt, completion)

    return {
        "newCalls": [{
            "agent": agent_name,
            "input": prompt,
            "output": completion,
            "cost": cost,
        }],
        "addedInput": prompt,
        "addedOutput": completion,
        "addedCost": cost,
    }


def print_token_summary(token_usage: Dict[str, Any]) -> None:
    if not token_usage:
        print("\n📊 Token Usage: No data recorded.")
        return

    calls: List[Dict[str, Any]] = token_usage.get("calls", [])
    total_input = token_usage.get("totalInput", 0)
    total_output = token_usage.get("totalOutput", 0)
    total_cost = token_usage.get("estimatedCost", 0.0)

    print("\n" + "═" * 60)
    print("  📊 TOKEN USAGE & COST SUMMARY")
    print("═" * 60)
    print(f"  Total API Calls:     {len(calls)}")
    print(f"  Total Input Tokens:  {total_input:,}")
    print(f"  Total Output Tokens: {total_output:,}")
    print(f"  Total Tokens:        {total_input + total_output:,}")
    print(f"  Estimated Cost:      ${total_cost:.4f} USD")
    print("═" * 60)

    if calls:
        print("\n  Breakdown by Agent Call:")
        for idx, call in enumerate(calls, 1):
            agent = call.get("agent", "unknown")
            inp = call.get("input", 0)
            out = call.get("output", 0)
            cst = call.get("cost", 0.0)
            print(f"   {idx:2d}. {agent:<20} in: {inp:5d} | out: {out:5d} | ${cst:.5f}")
    print("═" * 60 + "\n")
