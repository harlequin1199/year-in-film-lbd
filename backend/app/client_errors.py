import logging
from datetime import datetime
from typing import Literal

from pydantic import BaseModel
from .client_errors_repository import ClientErrorsRepository

logger = logging.getLogger(__name__)


class ClientErrorEventIn(BaseModel):
    errorId: str
    message: str
    stack: str | None = None
    componentStack: str | None = None
    boundaryScope: Literal["global", "feature"]
    featureName: str | None = None
    route: str | None = None
    userAgent: str | None = None
    timestamp: datetime


def persist_client_error_event(
    payload: ClientErrorEventIn,
    repository: ClientErrorsRepository | None = None,
) -> None:
    repo = repository or ClientErrorsRepository()
    try:
        repo.insert_event(payload.model_dump())
    except Exception:
        logger.exception("Failed to persist client error event")
