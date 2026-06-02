import os, sys, base64, tempfile, asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODEL_DIR = "/workspace/ltx-models"

class VideoRequest(BaseModel):
    prompt: str
    num_frames: int = 97
    height: int = 512
    width: int = 768
    seed: int = 42

@app.get("/health")
async def health():
    return {"status": "ok", "model": "LTX-2.3", "gpu": "A100 80GB"}

@app.post("/generate")
async def generate(r: VideoRequest):
    o = tempfile.mktemp(suffix=".mp4")
    files = [f for f in os.listdir(MODEL_DIR) if f.endswith(".safetensors") and "lora" not in f.lower() and "upsampler" not in f.lower()]
    if not files:
        return {"status": "error", "error": "No model checkpoint found"}
    ckpt = os.path.join(MODEL_DIR, files[0])

    cmd = [sys.executable, "-m", "ltx_pipelines.t2v", "--ckpt_path", ckpt,
           "--prompt", r.prompt, "--height", str(r.height), "--width", str(r.width),
           "--num_frames", str(r.num_frames), "--seed", str(r.seed), "--output_path", o]

    loras = [f for f in os.listdir(MODEL_DIR) if "distilled" in f.lower() and f.endswith(".safetensors")]
    if loras:
        cmd.extend(["--distilled_lora", os.path.join(MODEL_DIR, loras[0]), "0.8"])

    ups = [f for f in os.listdir(MODEL_DIR) if "upsampler" in f.lower() and f.endswith(".safetensors")]
    if ups:
        cmd.extend(["--spatial_upsampler_path", os.path.join(MODEL_DIR, ups[0])])

    try:
        p = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        so, se = await asyncio.wait_for(p.communicate(), timeout=600)
        if os.path.exists(o):
            with open(o, "rb") as f:
                v = base64.b64encode(f.read()).decode()
            os.remove(o)
            return {"status": "success", "video_base64": v}
        return {"status": "error", "error": se.decode()[-2000:]}
    except asyncio.TimeoutError:
        return {"status": "error", "error": "Timeout (10 min)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

uvicorn.run(app, host="0.0.0.0", port=8000)
