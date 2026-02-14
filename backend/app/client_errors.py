from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class ClientErrorEventIn(BaseModel):
    errorId: str
    message: str
    stack: Optional[str] = None
    componentStack: Optional[str] = None
    boundaryScope: Literal['global', 'feature']
    featureName: Optional[str] = None
    route: Optional[str] = None
    userAgent: Optional[str] = None
    timestamp: datetime


class ClientErrorEventOut(BaseModel):
    errorId: str
