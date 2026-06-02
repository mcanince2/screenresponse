#!/bin/bash
# LTX-2.3 Video Generation Setup Script for RunPod
# Run this on the RunPod pod after it starts

set -e

echo "=== LTX-2.3 Video Generation Setup ==="

# Install dependencies
pip install fastapi uvicorn huggingface_hub python-multipart aiofiles

# Clone LTX-2 repo if not present
if [ ! -d /workspace/LTX-2 ]; then
    echo "Cloning LTX-2 repository..."
    cd /workspace
    git clone https://github.com/Lightricks/LTX-2.git
    cd LTX-2
    pip install -e packages/ltx-core
    pip install -e packages/ltx-pipelines
else
    echo "LTX-2 already cloned"
fi

# Download model weights
echo "Downloading LTX-2.3 model weights..."
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('Lightricks/LTX-2.3', local_dir='/workspace/ltx-models', ignore_patterns=['*.md', '*.txt', '*.gitattributes'])
print('Model download complete!')
"

# Write the API server
cat > /workspace/api_server.py << 'PYEOF'
import os
import sys
import base64
import tempfile
import subprocess
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="LTX-2.3 Video Generation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_DIR = "/workspace/ltx-models"

class VideoRequest(BaseModel):
    prompt: str
    num_frames: int = 97
    height: int = 512
    width: int = 768
    seed: int = 42
    guidance_scale: float = 3.0

class VideoResponse(BaseModel):
    status: str
    video_base64: Optional[str] = None
    error: Optional[str] = None
    prompt: str = ""

@app.get("/health")
async def health():
    return {"status": "ok", "model": "LTX-2.3", "gpu": "A100 80GB"}

@app.post("/generate", response_model=VideoResponse)
async def generate_video(req: VideoRequest):
    output_path = tempfile.mktemp(suffix=".mp4")

    # Find the correct model files
    ckpt = None
    for f in os.listdir(MODEL_DIR):
        if f.endswith(".safetensors") and "lora" not in f.lower() and "upsampler" not in f.lower():
            ckpt = os.path.join(MODEL_DIR, f)
            break

    if not ckpt:
        raise HTTPException(status_code=500, detail="Model checkpoint not found")

    # Build command
    cmd = [
        sys.executable, "-m", "ltx_pipelines.t2v",
        "--ckpt_path", ckpt,
        "--prompt", req.prompt,
        "--height", str(req.height),
        "--width", str(req.width),
        "--num_frames", str(req.num_frames),
        "--seed", str(req.seed),
        "--output_path", output_path
    ]

    # Check for distilled lora
    for f in os.listdir(MODEL_DIR):
        if "distilled" in f.lower() and f.endswith(".safetensors"):
            cmd.extend(["--distilled_lora", os.path.join(MODEL_DIR, f), "0.8"])
            break

    # Check for upsampler
    for f in os.listdir(MODEL_DIR):
        if "upsampler" in f.lower() and f.endswith(".safetensors"):
            cmd.extend(["--spatial_upsampler_path", os.path.join(MODEL_DIR, f)])
            break

    # Check for gemma
    gemma_dir = os.path.join(MODEL_DIR, "gemma")
    if os.path.exists(gemma_dir):
        cmd.extend(["--gemma_root", gemma_dir])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

        if os.path.exists(output_path):
            with open(output_path, "rb") as f:
                video_b64 = base64.b64encode(f.read()).decode()
            os.remove(output_path)
            return VideoResponse(status="success", video_base64=video_b64, prompt=req.prompt)
        else:
            return VideoResponse(
                status="error",
                error=stderr.decode()[-2000:] if stderr else "No output file generated",
                prompt=req.prompt
            )
    except asyncio.TimeoutError:
        return VideoResponse(status="error", error="Generation timed out (10 min limit)", prompt=req.prompt)
    except Exception as e:
        return VideoResponse(status="error", error=str(e), prompt=req.prompt)

@app.get("/models")
async def list_models():
    files = os.listdir(MODEL_DIR) if os.path.exists(MODEL_DIR) else []
    return {"files": files}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
PYEOF

echo ""
echo "=== Setup Complete ==="
echo "Starting API server on port 8000..."
python3 /workspace/api_server.py
