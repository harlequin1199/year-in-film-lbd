from pathlib import Path


def test_legacy_client_error_migration_removed():
    path = Path("migrations/2026_02_14_create_client_error_events.sql")
    assert not path.exists()
