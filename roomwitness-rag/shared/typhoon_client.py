import os

from langchain_openai import ChatOpenAI


def get_typhoon_llm(temperature: float = 0.1) -> ChatOpenAI:
    """
    Returns a LangChain-compatible ChatOpenAI instance for Agent 02/03/04's text LLM.

    Routed to a local LM Studio Qwen instruct model instead of Typhoon v2 —
    swap LLM_BASE_URL/LLM_MODEL back to a hosted endpoint if needed.

    Args:
        temperature: Sampling temperature.
            0.1  — Agent 02 and 03 (reasoning tasks, some variation allowed)
            0.05 — Agent 04 (document generation, must be deterministic)
    """
    return ChatOpenAI(
        api_key=os.getenv("LLM_API_KEY", "lm-studio"),
        base_url=os.getenv("LLM_BASE_URL", "http://localhost:1234/v1"),
        model=os.getenv("LLM_MODEL", "qwen2.5-7b-instruct-1m"),
        temperature=temperature,
        max_tokens=4096,  # default cap truncates mid-JSON on real multi-claim leases (finish_reason=length)
    )
