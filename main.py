"""
main.py — Main Entry Point for AI Dev Team (Python Edition)

Run:
  python main.py "Build me a task management web app"
Or interactive mode:
  python main.py
Or resume state:
  python main.py --resume <thread-id>
"""

import sys
import time
import argparse
from dotenv import load_dotenv

load_dotenv()

from src.guardrails.input_guardrail import validate_user_input
from src.utils.gemini_client import init_gemini
from src.utils.token_tracker import print_token_summary
from src.utils.langsmith_tracer import init_langsmith_tracer
from src.config.graph import build_graph, create_checkpointer
from src.config.state import create_initial_state


def print_banner():
    print("")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║                                                          ║")
    print("║    🤖  AI DEV TEAM — Multi-Agent System (Python)        ║")
    print("║                                                          ║")
    print("║    LangGraph + Gemini + Guardrails + Pure Local Sandbox ║")
    print("║    Observability & Tracing via LangSmith                ║")
    print("║                                                          ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print("")


def main():
    print_banner()

    parser = argparse.ArgumentParser(description="AI Dev Team CLI")
    parser.add_argument("requirement", nargs="*", help="Software requirement prompt")
    parser.add_argument("--resume", type=str, help="Thread ID to resume execution from checkpoint")
    args = parser.parse_args()

    # 1. Initialize Gemini API Client & LangSmith Tracer
    try:
        init_gemini()
        print("✅ Gemini API initialized cleanly")
    except Exception as err:
        print(f"❌ Gemini Initialization Error: {str(err)}")
        print("   Please ensure GEMINI_API_KEY is set in your .env file.")
        sys.exit(1)

    # 2. Checkpointer & Graph setup
    checkpointer = create_checkpointer()
    graph = build_graph({"checkpointer": checkpointer})

    thread_id = args.resume or f"project-{int(time.time())}"
    config = {
        "configurable": {"thread_id": thread_id},
        "recursion_limit": 500,
    }

    if args.resume:
        print(f"  🔄 RESUMING thread: {thread_id}\n")
        final_state = graph.invoke(None, config)
    else:
        req_text = " ".join(args.requirement).strip()
        if not req_text:
            print("  What do you want to build?\n")
            print('  Example: "Build a todo app with user authentication and categories"\n')
            req_text = input("  Your idea: ").strip()

        if not req_text:
            print("  No requirement provided. Exiting.")
            sys.exit(0)

        # Apply Input Guardrail
        is_valid, msg_or_cleaned, meta = validate_user_input(req_text)
        if not is_valid:
            print(f"\n  ❌ Input Guardrail Violation: {msg_or_cleaned} (reason: {meta.get('reason')})")
            sys.exit(1)

        requirement = msg_or_cleaned
        print(f'\n  📝 Requirement: "{requirement}"')
        print(f"  🧵 Thread ID: {thread_id}  (save this to resume if needed)\n")
        print("─" * 60)

        initial_state = create_initial_state(user_requirement=requirement, token_budget=2.0)
        final_state = graph.invoke(initial_state, config)

    # 3. Print Token Usage Summary
    if final_state and isinstance(final_state, dict):
        print_token_summary(final_state.get("tokenUsage"))


if __name__ == "__main__":
    main()
