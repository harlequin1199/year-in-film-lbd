import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import _redact_sentry_event


def test_redact_auth_headers_and_cookies():
    event = {
        "request": {
            "headers": {"authorization": "secret", "cookie": "session=abc"},
            "url": "https://x/?token=abc",
        }
    }
    out = _redact_sentry_event(event, None)
    assert out["request"]["headers"].get("authorization") is None
    assert out["request"]["headers"].get("cookie") is None
