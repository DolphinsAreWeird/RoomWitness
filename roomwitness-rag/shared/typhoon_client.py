import os

from langchain_openai import ChatOpenAI

try:
    from langchain_aws import ChatBedrockConverse
except ImportError:
    ChatBedrockConverse = None


def get_typhoon_llm(temperature: float = 0.1):
    """
    Returns a LangChain-compatible chat model for Agent 02/03/04's text LLM.

    LLM_PROVIDER=bedrock (deployed) -> Bedrock Converse, Claude Haiku 4.5, IAM-role auth.
    LLM_PROVIDER unset/anything else (local dev) -> local LM Studio Qwen instruct model.

    Args:
        temperature: Sampling temperature.
            0.1  — Agent 02 and 03 (reasoning tasks, some variation allowed)
            0.05 — Agent 04 (document generation, must be deterministic)
    """
    if os.getenv("LLM_PROVIDER") == "bedrock":
        if ChatBedrockConverse is None:
            raise RuntimeError("LLM_PROVIDER=bedrock but langchain-aws is not installed")
        return ChatBedrockConverse(
            model=os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-4-5-20251001-v1:0"),
            region_name=os.getenv("AWS_REGION", "ap-southeast-1"),
            temperature=temperature,
            max_tokens=4096,
        )

    return ChatOpenAI(
        api_key=os.getenv("LLM_API_KEY", "lm-studio"),
        base_url=os.getenv("LLM_BASE_URL", "http://localhost:1234/v1"),
        model=os.getenv("LLM_MODEL", "qwen2.5-7b-instruct-1m"),
        temperature=temperature,
        max_tokens=4096,  # default cap truncates mid-JSON on real multi-claim leases (finish_reason=length)
    )
