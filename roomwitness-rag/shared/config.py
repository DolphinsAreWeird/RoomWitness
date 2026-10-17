from dotenv import load_dotenv
import os

load_dotenv()

# Groq — used by Agent 01 (CV) for Llama-4-Scout vision inference
# TODO: Create a free Groq account at https://console.groq.com to obtain your API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Typhoon v2 — Primary Thai LLM by SCB10X (local-dev/legacy provider only; not required
# when LLM_PROVIDER=bedrock — see shared/typhoon_client.py for the actual provider switch).
TYPHOON_API_KEY = os.getenv("TYPHOON_API_KEY")
TYPHOON_BASE_URL = os.getenv("TYPHOON_BASE_URL", "https://api.opentyphoon.ai/v1")
TYPHOON_MODEL = os.getenv("TYPHOON_MODEL", "typhoon-v2-70b-instruct")

# AWS S3
# TODO: Create an IAM user with S3 permissions and fill in credentials in .env
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "ap-southeast-1")
S3_BUCKET = os.getenv("S3_BUCKET", "roomwitness-cases")

# ChromaDB
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
