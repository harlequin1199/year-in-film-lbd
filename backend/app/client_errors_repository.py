import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable

MAX_STACK_LEN = 16384


def _trim(value: str | None) -> str | None:
    if value is None:
        return None
    return value[:MAX_STACK_LEN]


def _parse_timestamp(value: str | datetime | None) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    return datetime.now(timezone.utc)


class ClientErrorsRepository:
    def __init__(self, connection_factory: Callable[[], Any] | None = None):
        self._connection_factory = connection_factory or self._default_connection_factory

    @staticmethod
    def _default_connection_factory():
        database_url = (os.getenv("DATABASE_URL") or "").strip()
        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured")
        try:
            from psycopg import connect  # type: ignore
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("psycopg is required for client error persistence") from exc
        return connect(database_url)

    def insert_event(self, event: dict[str, Any]) -> str:
        event_id = str(uuid.uuid4())
        created_at = _parse_timestamp(event.get("timestamp"))

        with self._connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO client_error_events (
                      id, error_id, message, stack, component_stack, scope,
                      feature_name, route, user_agent, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (error_id) DO UPDATE
                    SET
                      message = EXCLUDED.message,
                      stack = EXCLUDED.stack,
                      component_stack = EXCLUDED.component_stack,
                      scope = EXCLUDED.scope,
                      feature_name = EXCLUDED.feature_name,
                      route = EXCLUDED.route,
                      user_agent = EXCLUDED.user_agent,
                      created_at = EXCLUDED.created_at
                    """,
                    (
                        event_id,
                        event.get("errorId"),
                        event.get("message"),
                        _trim(event.get("stack")),
                        _trim(event.get("componentStack")),
                        event.get("boundaryScope"),
                        event.get("featureName"),
                        event.get("route"),
                        event.get("userAgent"),
                        created_at,
                    ),
                )
            if hasattr(conn, "commit"):
                conn.commit()

        return event_id

    def get_by_error_id(self, error_id: str) -> dict[str, Any] | None:
        with self._connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, error_id, message, stack, component_stack, scope,
                           feature_name, route, user_agent, created_at
                    FROM client_error_events
                    WHERE error_id = %s
                    """,
                    (error_id,),
                )
                row = cur.fetchone()

        if row is None:
            return None
        return dict(row)
