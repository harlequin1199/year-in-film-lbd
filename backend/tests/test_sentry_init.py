import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import _should_enable_sentry


def test_should_enable_sentry_true_when_flag_and_dsn_present():
    assert _should_enable_sentry({"SENTRY_ENABLED": "true", "SENTRY_DSN": "x"}) is True
