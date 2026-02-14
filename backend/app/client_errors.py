from datetime import datetime
from typing import Literal

from pydantic import BaseModel


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
