"""
server.py — FastAPI Web Server for AI Dev Team Web Dashboard UI
Modular entrypoint connecting FastAPI routers, security middlewares, and static SPA serving.
"""

import os
import time
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from src.routes import (
    auth_router,
    chats_router,
    sandboxes_router,
    projects_router,
    rag_router,
    system_router,
)
from src.routes.auth import load_users, save_users, hash_password
from src.routes.sandboxes import _sanitize_sandbox_env

app = FastAPI(title="AI Dev Team Web Dashboard")

# 1. GZip Compression Middleware (for responses >= 1KB)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS Middleware (Restricted to trusted origins, preventing wildcard credential vulnerability)
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8000,http://127.0.0.1:5173,http://127.0.0.1:8000")
allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 3. Security Headers & Request Latency Middleware
@app.middleware("http")
async def add_security_headers_and_latency(request: Request, call_next):
    start_time = time.time()
    try:
        response = await call_next(request)
    except Exception as exc:
        process_time = (time.time() - start_time) * 1000
        print(f" Exception processing {request.method} {request.url.path}: {exc} ({process_time:.2f}ms)")
        raise exc

    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# 4. Global Exception Handler for 500 Unhandled Errors (Suppresses internal stack trace leakage)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f" Unhandled Error at {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred while processing your request."},
    )

# 5. Include Modular API Routers
app.include_router(auth_router)
app.include_router(chats_router)
app.include_router(sandboxes_router)
app.include_router(projects_router)
app.include_router(rag_router)
app.include_router(system_router)

# 6. Serve Frontend Static Assets if Built
frontend_dist = os.path.join(os.getcwd(), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend_spa(full_path: str):
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return {"status": "Frontend dist index.html not found"}


if __name__ == "__main__":
    import uvicorn
    print("\n" + "═" * 60)
    print("   AI DEV TEAM — Web Dashboard UI Server")
    print("   Dashboard running at: http://localhost:8000")
    print("═" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
