from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import time

logger = logging.getLogger("green_guardian")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Green Guardian API")

# Restrict CORS to configured frontend origins. Set ALLOWED_ORIGINS as a
# comma-separated list in the Lambda environment (e.g. "https://app.example.com").
# Falls back to localhost dev origins when unset. Credentials are disabled because
# the API uses no cookies/sessions — combining "*" with credentials is unsafe.
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
if _raw_origins:
    ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            "http://127.0.0.1:3002",
            "http://localhost:3411",
        ],
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

def _get_int_env(name: str, default: int, minimum: int = 1) -> int:
    """Parse an int env var, clamping to a minimum; fall back on bad input."""
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return max(minimum, int(raw))
    except ValueError:
        logger.warning("Invalid %s=%r; using default %d", name, raw, default)
        return default


# Reject uploads larger than this (default 10 MB).
MAX_UPLOAD_BYTES = _get_int_env("MAX_UPLOAD_BYTES", 10 * 1024 * 1024)

# Best-effort per-IP rate limiting. NOTE: Lambda memory is per-container, so this
# only throttles within a single warm container. Real enforcement belongs at the
# API Gateway level (throttling / usage plan) — see SECURITY.md.
RATE_LIMIT_MAX = _get_int_env("RATE_LIMIT_MAX", 30)
RATE_LIMIT_WINDOW_SECONDS = _get_int_env("RATE_LIMIT_WINDOW_SECONDS", 60)
# Hard cap on tracked IPs so untrusted/high-cardinality traffic can't grow the
# map without bound inside a warm container.
MAX_TRACKED_IPS = _get_int_env("MAX_TRACKED_IPS", 1000)
_request_log: dict[str, list[float]] = {}


def _client_ip(request: Request) -> str:
    """Best-effort client IP.

    Honors API Gateway's X-Forwarded-For (first hop = original client). That
    value is client-influenceable, so it is only used for best-effort
    throttling; the MAX_TRACKED_IPS cap bounds memory regardless of spoofing.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune_request_log(now: float) -> None:
    """Drop expired/empty IP entries and enforce the MAX_TRACKED_IPS cap."""
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    stale = [ip for ip, hits in _request_log.items() if not hits or hits[-1] <= window_start]
    for ip in stale:
        del _request_log[ip]
    overflow = len(_request_log) - MAX_TRACKED_IPS
    if overflow > 0:
        # Evict the least-recently-active IPs first.
        oldest = sorted(_request_log.items(), key=lambda kv: kv[1][-1])[:overflow]
        for ip, _ in oldest:
            del _request_log[ip]


def _is_rate_limited(ip: str) -> bool:
    """Sliding-window check; records the request timestamp when allowed."""
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    recent = [t for t in _request_log.get(ip, []) if t > window_start]
    if len(recent) >= RATE_LIMIT_MAX:
        _request_log[ip] = recent
        return True
    recent.append(now)
    _request_log[ip] = recent
    _prune_request_log(now)
    return False


from model.predictor import predict_disease

@app.get("/")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Green Guardian API",
        "version": "1.0.0"
    }

@app.post("/predict")
async def predict(request: Request):
    """
    Predict plant disease from leaf image
    Manually parses multipart/form-data to avoid Mangum corruption
    """
    try:
        client_ip = _client_ip(request)
        if _is_rate_limited(client_ip):
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
            )

        # Fast reject when the client declares an oversized body.
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                if int(content_length) > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Image too large.")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid Content-Length header.")

        # Stream the body and abort as soon as it exceeds the cap, so a missing or
        # spoofed Content-Length cannot force us to accumulate an unbounded payload.
        # NOTE: under API Gateway + Lambda the platform buffers the full request
        # before this code runs, so also cap the payload at the gateway — see
        # SECURITY.md.
        chunks: list[bytes] = []
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="Image too large.")
            chunks.append(chunk)
        body = b"".join(chunks)

        print(f"Raw body length: {len(body)} bytes")
        print(f"Content-Type: {request.headers.get('content-type')}")
        print(f"First 20 bytes (hex): {body[:20].hex()}")
        
        content_type = request.headers.get('content-type', '')
        if 'multipart/form-data' not in content_type:
            raise HTTPException(status_code=400, detail="Must be multipart/form-data")
        
        boundary = None
        for part in content_type.split(';'):
            part = part.strip()
            if part.startswith('boundary='):
                boundary = part.split('=', 1)[1].strip('"')
                break
        
        if not boundary:
            raise HTTPException(status_code=400, detail="No boundary in Content-Type")
        
        print(f"Boundary: {boundary}")
        
        boundary_bytes = f'--{boundary}'.encode()
        parts = body.split(boundary_bytes)
        
        file_data = None
        for part in parts:
            if b'name="file"' in part:
                header_end = part.find(b'\r\n\r\n')
                if header_end == -1:
                    header_end = part.find(b'\n\n')
                    if header_end != -1:
                        file_data = part[header_end + 2:].rstrip(b'\r\n-')
                else:
                    file_data = part[header_end + 4:].rstrip(b'\r\n-')
                break
        
        if not file_data:
            raise HTTPException(status_code=400, detail="No file found in request")
        
        print(f"Extracted file data: {len(file_data)} bytes")
        print(f"First 16 bytes (hex): {file_data[:16].hex()}")
        

        is_jpeg = file_data.startswith(b'\xff\xd8\xff')
        is_png = file_data.startswith(b'\x89PNG')
        is_webp = file_data.startswith(b'RIFF') and len(file_data) > 12 and file_data[8:12] == b'WEBP'
        
        if not (is_jpeg or is_png or is_webp):
            print(f"WARNING: File doesn't start with JPEG, PNG, or WebP magic bytes")
            print(f"  Got: {file_data[:10].hex()}")
            raise HTTPException(
                status_code=400,
                detail=f"Invalid image format. Supported formats: JPEG, PNG, WebP. First bytes: {file_data[:10].hex()}"
            )
        
        format_name = 'JPEG' if is_jpeg else ('PNG' if is_png else 'WebP')
        print(f"✓ Valid image detected ({format_name})")
        

        result = predict_disease(file_data)
        
        return result
    
    except HTTPException:
        raise
    except Exception:
        # Log full detail server-side (CloudWatch); return a generic message so
        # internal paths / library internals are not leaked to the caller.
        logger.exception("Prediction request failed")
        raise HTTPException(
            status_code=500,
            detail="Internal error while processing the image. Please try again.",
        )