"""ASGI entrypoint shim for PaaS start commands.

Render was configured to run `uvicorn main:app`, which expects a top-level
`main.py` module in the backend root. The actual FastAPI app lives in
`app/main.py`, so we re-export it here to support both:
- `uvicorn main:app`
- `uvicorn app.main:app`
"""

from app.main import app


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.getenv("PORT", "10000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
