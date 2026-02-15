import sys
from pathlib import Path
from datetime import timezone

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.client_errors_repository import ClientErrorsRepository
from app.client_errors_repository import _parse_timestamp


class _FakeCursor:
    def __init__(self, storage):
        self.storage = storage
        self._last_row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params):
        normalized = " ".join(query.split()).lower()
        if normalized.startswith("insert into client_error_events"):
            self.storage["rows"][params[1]] = {
                "id": params[0],
                "error_id": params[1],
                "message": params[2],
                "stack": params[3],
                "component_stack": params[4],
                "scope": params[5],
                "feature_name": params[6],
                "route": params[7],
                "user_agent": params[8],
                "created_at": params[9],
            }
        elif normalized.startswith("select"):
            self._last_row = self.storage["rows"].get(params[0])

    def fetchone(self):
        return self._last_row


class _FakeConnection:
    def __init__(self, storage):
        self.storage = storage

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return _FakeCursor(self.storage)

    def commit(self):
        return None


def test_trim_long_stack_before_insert():
    storage = {"rows": {}}
    repository = ClientErrorsRepository(connection_factory=lambda: _FakeConnection(storage))
    long_stack = "x" * 20000

    event_id = repository.insert_event(
        {
            "errorId": "e1",
            "message": "boom",
            "stack": long_stack,
            "componentStack": long_stack,
            "boundaryScope": "global",
            "featureName": None,
            "route": "/",
            "userAgent": "ua",
            "timestamp": "2026-02-14T00:00:00.000Z",
        }
    )
    saved = repository.get_by_error_id("e1")

    assert event_id is not None
    assert saved is not None
    assert len(saved["stack"]) <= 16384
    assert len(saved["component_stack"]) <= 16384


def test_parse_timestamp_defaults_to_timezone_aware_utc():
    ts = _parse_timestamp(None)
    assert ts.tzinfo is not None
    assert ts.tzinfo == timezone.utc
