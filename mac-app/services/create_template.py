#!/usr/bin/env python3
"""Create RunPod serverless template for LTX-2.3"""
import json
import subprocess
import base64
import sys
import os

RUNPOD_KEY = os.environ.get("RUNPOD_API_KEY", "")
if not RUNPOD_KEY:
    sys.exit("Error: set the RUNPOD_API_KEY environment variable first (see .env.example).")

# Read and encode server.py
script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, "server.py"), "rb") as f:
    server_b64 = base64.b64encode(f.read()).decode()

# Handler for RunPod serverless (replaces the FastAPI server)
handler_code = '''
import runpod
import os
import sys
import base64
import tempfile
import subprocess

MODEL_DIR = "/runpod-volume/ltx-models"

def handler(event):
    input_data = event.get("input", {})
    prompt = input_data.get("prompt", "A beautiful sunset")
    num_frames = input_data.get("num_frames", 97)
    height = input_data.get("height", 512)
    width = input_data.get("width", 768)
    seed = input_data.get("seed", 42)

    output_path = tempfile.mktemp(suffix=".mp4")

    # Find checkpoint
    files = [f for f in os.listdir(MODEL_DIR) if f.endswith(".safetensors") and "lora" not in f.lower() and "upsampler" not in f.lower()]
    if not files:
        return {"status": "error", "error": "No model checkpoint found in " + MODEL_DIR}
    ckpt = os.path.join(MODEL_DIR, files[0])

    cmd = [sys.executable, "-m", "ltx_pipelines.t2v",
           "--ckpt_path", ckpt,
           "--prompt", prompt,
           "--height", str(height),
           "--width", str(width),
           "--num_frames", str(num_frames),
           "--seed", str(seed),
           "--output_path", output_path]

    # Add distilled lora if exists
    loras = [f for f in os.listdir(MODEL_DIR) if "distilled" in f.lower() and f.endswith(".safetensors")]
    if loras:
        cmd.extend(["--distilled_lora", os.path.join(MODEL_DIR, loras[0]), "0.8"])

    # Add upsampler if exists
    ups = [f for f in os.listdir(MODEL_DIR) if "upsampler" in f.lower() and f.endswith(".safetensors")]
    if ups:
        cmd.extend(["--spatial_upsampler_path", os.path.join(MODEL_DIR, ups[0])])

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if os.path.exists(output_path):
            with open(output_path, "rb") as f:
                video_b64 = base64.b64encode(f.read()).decode()
            os.remove(output_path)
            return {"status": "success", "video_base64": video_b64, "prompt": prompt}
        return {"status": "error", "error": result.stderr[-2000:] if result.stderr else "No output"}
    except subprocess.TimeoutExpired:
        return {"status": "error", "error": "Timeout (10 min)"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

runpod.serverless.start({"handler": handler})
'''

handler_b64 = base64.b64encode(handler_code.encode()).decode()

# Docker startup command - single line, no escaping issues
# Uses base64 encoded handler to avoid quoting problems
docker_args = (
    "bash -c '"
    "pip install -q runpod huggingface_hub einops transformers safetensors accelerate scipy av tqdm pillow numpy && "
    "if [ ! -d /runpod-volume/LTX-2 ]; then "
    "git clone https://github.com/Lightricks/LTX-2.git /runpod-volume/LTX-2; "
    "fi && "
    "cd /runpod-volume/LTX-2 && "
    "pip install --no-deps -q -e packages/ltx-core && "
    "pip install --no-deps -q -e packages/ltx-pipelines && "
    "if [ ! -d /runpod-volume/ltx-models ] || [ -z \"$(ls /runpod-volume/ltx-models/*.safetensors 2>/dev/null)\" ]; then "
    "python3 -c \"from huggingface_hub import snapshot_download; "
    "snapshot_download(\\\"Lightricks/LTX-2.3\\\", local_dir=\\\"/runpod-volume/ltx-models\\\", "
    "ignore_patterns=[\\\"*.md\\\",\\\"*.txt\\\",\\\"*.gitattributes\\\"])\"; "
    "fi && "
    "echo $HANDLER_CODE | base64 -d > /handler.py && "
    "python3 /handler.py"
    "'"
)

variables = {
    "input": {
        "name": "LTX-2.3-Serverless-L40",
        "imageName": "runpod/pytorch:1.0.3-cu1281-torch290-ubuntu2204",
        "isServerless": True,
        "containerDiskInGb": 30,
        "volumeInGb": 0,
        "volumeMountPath": "/runpod-volume",
        "env": [
            {"key": "HANDLER_CODE", "value": handler_b64}
        ],
        "dockerArgs": docker_args
    }
}

query = "mutation SaveTemplate($input: SaveTemplateInput!) { saveTemplate(input: $input) { id name } }"
payload = json.dumps({"query": query, "variables": variables})

result = subprocess.run(
    ["curl", "-s", f"https://api.runpod.io/graphql?api_key={RUNPOD_KEY}",
     "-H", "Content-Type: application/json",
     "-d", payload],
    capture_output=True, text=True
)
print(result.stdout)
