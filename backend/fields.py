from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Dict, Optional
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from .db import TYPES, as_json


class StrictBody(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class RecordData(StrictBody):
    academic_year_id: int = Field(gt=0)
    school_id: int = Field(gt=0)
    department_id: int = Field(gt=0)
    programme_id: Optional[int] = Field(default=None, gt=0)
    proof: Optional[str] = Field(default=None, max_length=2048)
    remarks: Optional[str] = Field(default=None, max_length=6000)
    details: Dict[str, object] = Field(default_factory=dict, max_length=80)


class NewRecord(RecordData):
    type_id: int = Field(ge=1, le=25)


class RecordEdit(StrictBody):
    academic_year_id: Optional[int] = Field(default=None, gt=0)
    school_id: Optional[int] = Field(default=None, gt=0)
    department_id: Optional[int] = Field(default=None, gt=0)
    programme_id: Optional[int] = Field(default=None, gt=0)
    proof: Optional[str] = Field(default=None, max_length=2048)
    remarks: Optional[str] = Field(default=None, max_length=6000)
    details: Dict[str, object] = Field(default_factory=dict, max_length=80)


class Reason(StrictBody):
    reason: str = Field(min_length=1, max_length=2000)


class ReviewerAssignment(StrictBody):
    user_id: int = Field(gt=0)


class LinkRecord(StrictBody):
    target_id: UUID
    relationship: str = Field(min_length=1, max_length=80)


class EvidenceBody(StrictBody):
    filename: str = Field(min_length=1, max_length=180)
    content_type: str = Field(max_length=100)
    content_base64: str = Field(min_length=4, max_length=4*1024*1024)


READ_ONLY = {14: {'grant_year'}}
REQUIRED = {4: {'duration'}}
COMMON = ('academic_year_id', 'school_id', 'department_id', 'programme_id', 'proof', 'remarks')
FILE_TYPES = ('application/pdf', 'image/png', 'image/jpeg', 'text/plain')


def identifier(name):
    return '"' + name.replace('"', '""') + '"'


def safe_proof(value):
    if value is None or not value:
        return None
    try:
        url = urlsplit(value)
        if url.scheme in ('http','https') and url.hostname and not url.username and not url.password and not any(
            char.isspace() or ord(char) < 32 or char == '\\' for char in value
        ):
            return value
    except ValueError:
        pass
    raise HTTPException(422, 'Proof links must be absolute HTTP or HTTPS URLs without credentials.')


def field_value(column, value):
    if value is None:
        return None
    kind = column['type']
    if kind == 'text':
        if not isinstance(value, str) or len(value) > 12000 or '\x00' in value:
            raise ValueError('Use text up to 12,000 characters.')
        value = value.strip()
        if column['options'] and value not in column['options']:
            raise ValueError('Choose one of the listed options.')
        return value or None
    if kind == 'boolean':
        if type(value) is not bool:
            raise ValueError('Use true or false.')
        return value
    if kind in ('integer', 'smallint'):
        maximum = 32767 if kind == 'smallint' else 2147483647
        if type(value) is not int or not 0 <= value <= maximum:
            raise ValueError(f'Use a whole number from 0 to {maximum}.')
        return value
    if kind == 'date':
        if not isinstance(value, str) or len(value) != 10:
            raise ValueError('Use a date in YYYY-MM-DD format.')
        return date.fromisoformat(value)
    if kind.startswith('numeric'):
        if type(value) not in (str,int,float) or len(str(value)) > 40:
            raise ValueError('Use a decimal number.')
        try:
            number = Decimal(str(value))
            digits = int(kind.removeprefix('numeric(').split(',')[0]) - 2
            if not number.is_finite() or not 0 <= number < 10**digits or number.quantize(Decimal('0.01')) != number:
                raise ValueError(f'Use a non-negative decimal with up to {digits} integer and 2 fractional digits.')
            return number
        except InvalidOperation as exc:
            raise ValueError('Use a valid decimal number.') from exc
    if kind == 'jsonb':
        if not isinstance(value, (list, dict)) or len(as_json(value)) > 32000:
            raise ValueError('Use a JSON object or array up to 32,000 characters.')
        return value
    raise ValueError('Unsupported field type.')


def validate_details(type_id, details, restricted=False, creating=False):
    columns = {column['key']: column for column in TYPES[type_id]['columns']}
    result = {}
    for key, value in details.items():
        if key not in columns or key in READ_ONLY.get(type_id, set()):
            raise HTTPException(422, f'Unknown or read-only field: {key[:80]}')
        if columns[key]['restricted'] and not restricted:
            raise HTTPException(403, 'Your role cannot edit restricted fields.')
        try:
            result[key] = field_value(columns[key], value)
            if type_id == 21 and key == 'description' and result[key] and len(result[key].split()) > 100:
                raise ValueError('Use no more than 100 words.')
        except (ValueError, TypeError, RecursionError) as error:
            raise HTTPException(422, f'{key.replace("_", " ").capitalize()}: {error}') from error
    for key in REQUIRED.get(type_id, set()):
        if (creating or key in result) and result.get(key) is None:
            raise HTTPException(422, f'{key.capitalize()} is required.')
    return result


def public_details(type_id, details, restricted=False):
    return {column['key']: details.get(column['key']) for column in TYPES[type_id]['columns']
            if restricted or not column['restricted']}
