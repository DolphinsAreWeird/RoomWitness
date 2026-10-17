FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# CPU-only torch first — the default PyPI wheel pulls several GB of unused CUDA/nvidia
# packages (no GPU in Fargate). Installing it from the CPU index before the rest of
# requirements.txt means pip won't later resolve/reinstall the GPU variant.
RUN grep '^torch==' requirements.txt | xargs -r pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# No CMD baked in — each of the 4 agent services shares this image; the ECS task
# definition's `command` picks which uvicorn app + port to run.
