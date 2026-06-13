import base64
from uuid import UUID
from datetime import datetime

from src.core.exceptions import BadRequestError


def encode_cursor(created_at: datetime, item_id: UUID):
    raw_bytes = f"{created_at.isoformat()}|{str(item_id)}".encode('utf-8')
    return base64.urlsafe_b64encode(raw_bytes).decode('utf-8')


def decode_cursor(cursor_str: str) -> tuple[datetime, UUID]:
    try:
        raw_bytes = base64.urlsafe_b64decode(cursor_str.encode('utf-8'))
        parts = raw_bytes.decode('utf-8').split('|')
        
        parsed_date = datetime.fromisoformat(parts[0])
        parsed_uuid = UUID(parts[1])
    
        return (parsed_date, parsed_uuid)
    
    except(ValueError, TypeError, base64.binascii.Error) as e:
        raise BadRequestError("Invalid cursor format")
