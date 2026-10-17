"""
Adapter exposing an OpenAI-SDK-shaped `.chat.completions.create(...)` interface
backed by Bedrock Converse — lets agent01_cv/cv.py and evidence.py call Bedrock
without knowing the difference. Those modules only understand the OpenAI wire
format (image_url data URIs, response.choices[0].message.content); this class
translates both directions.
"""
import base64
import os
import re
from types import SimpleNamespace

import boto3


class _ChatCompletions:
    def __init__(self, bedrock_client, model_id: str):
        self._client = bedrock_client
        self._model_id = model_id

    def create(self, model: str, messages: list, temperature: float = 0.1, max_tokens: int = 800, **_):
        system = []
        converse_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system.append({"text": msg["content"]})
                continue
            content = msg["content"]
            if isinstance(content, str):
                converse_messages.append({"role": msg["role"], "content": [{"text": content}]})
                continue
            blocks = []
            for block in content:
                if block["type"] == "text":
                    blocks.append({"text": block["text"]})
                elif block["type"] == "image_url":
                    data_uri = block["image_url"]["url"]
                    match = re.match(r"data:image/(\w+);base64,(.+)", data_uri)
                    fmt, b64 = match.group(1), match.group(2)
                    blocks.append({"image": {"format": fmt, "source": {"bytes": base64.b64decode(b64)}}})
            converse_messages.append({"role": msg["role"], "content": blocks})

        resp = self._client.converse(
            modelId=self._model_id,
            system=system,
            messages=converse_messages,
            inferenceConfig={"temperature": temperature, "maxTokens": max_tokens},
        )
        text = resp["output"]["message"]["content"][0]["text"]
        # Mimic openai SDK's ChatCompletion response shape: resp.choices[0].message.content
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


class BedrockVisionClient:
    """Drop-in replacement for `openai.OpenAI` in agent01_cv/cv.py and evidence.py."""

    def __init__(self, region_name: str, model_id: str):
        bedrock_client = boto3.client("bedrock-runtime", region_name=region_name)
        self.chat = SimpleNamespace(completions=_ChatCompletions(bedrock_client, model_id))


def get_bedrock_vision_client() -> BedrockVisionClient:
    return BedrockVisionClient(
        region_name=os.getenv("AWS_REGION", "ap-southeast-1"),
        model_id=os.getenv("BEDROCK_MODEL_ID", "global.anthropic.claude-haiku-4-5-20251001-v1:0"),
    )
