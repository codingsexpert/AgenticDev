"""
human_input.py — Node for Collecting Terminal User Input (Q&A)
"""

from typing import Dict, Any


def human_input_node(state: Dict[str, Any]) -> Dict[str, Any]:
    questions = state.get("pmQuestions", [])
    if not questions:
        return {}

    print("\n❓ [PM Agent] Clarification needed:\n")
    answers_list = []
    for idx, q in enumerate(questions, 1):
        print(f"  {idx}. {q}")
        try:
            ans = input("     Your answer: ").strip()
        except (EOFError, KeyboardInterrupt):
            ans = "Proceed with standard reasonable assumptions."
        answers_list.append(f"Q: {q}\nA: {ans}")

    combined_answers = "\n".join(answers_list)
    return {
        "pmConversation": [{"role": "user", "answers": combined_answers}],
        "pmStatus": "idle",
    }
