import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import _should_enable_sentry
from app.main import _resolve_sentry_release


def test_should_enable_sentry_true_when_flag_and_dsn_present():
    assert _should_enable_sentry({"SENTRY_ENABLED": "true", "SENTRY_DSN": "x"}) is True


def test_resolve_sentry_release_prefers_explicit_release():
    assert _resolve_sentry_release({"SENTRY_RELEASE": "r1", "RENDER_GIT_COMMIT": "sha"}) == "r1"


def test_resolve_sentry_release_falls_back_to_render_git_commit():
    assert _resolve_sentry_release({"SENTRY_RELEASE": "", "RENDER_GIT_COMMIT": "sha"}) == "sha"
