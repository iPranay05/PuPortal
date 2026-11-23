import ipaddress
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import asyncpg
from fastapi import HTTPException, Request

ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'lib/catalog.json').read_text(encoding='utf-8'))
TYPES = {item['id']: item for item in CATALOG}
LOG = logging.getLogger(__name__)


def encode(value):
    if isinstance(value, (date, datetime, UUID, Decimal)):
        return str(value)
    raise TypeError(f'Unsupported JSON value: {type(value).__name__}')


def as_json(value):
    return json.dumps(value, default=encode, allow_nan=False)


async def configure_connection(conn):
    for name in ('json', 'jsonb'):
        await conn.set_type_codec(name, encoder=as_json, decoder=json.loads, schema='pg_catalog')


@asynccontextmanager
async def lifespan(app):
    app.state.pool = None
    app.state.database_configured = bool(os.getenv('DATABASE_URL'))
    if app.state.database_configured:
        try:
            app.state.pool = await asyncpg.create_pool(
                os.environ['DATABASE_URL'], min_size=0, max_size=4, timeout=5,
                command_timeout=15, init=configure_connection,
                server_settings={'search_path': 'accreditation,pg_catalog'},
            )
        except (ValueError, OSError, asyncpg.PostgresError):
            LOG.warning('Accreditation database settings could not be initialized')
    try:
        yield
    finally:
        if app.state.pool is not None:
            await app.state.pool.close()


async def connection(request: Request):
    pool = getattr(request.app.state, 'pool', None)
    if pool is None:
        raise HTTPException(503, 'PostgreSQL is not configured for this workspace.')
    async with pool.acquire(timeout=5) as conn:
        yield conn


def client_ip(request):
    try:
        return ipaddress.ip_address(request.client.host) if request.client else None
    except ValueError:
        return None


async def audit_context(conn, request, staff, role_id=None, reason=None):
    for name, value in (
        ('staff_id', staff.id), ('role_id', role_id), ('reason', reason),
        ('client_ip', client_ip(request)), ('device', request.headers.get('user-agent', '')[:512]),
        ('session_id', staff.session_id),
    ):
        await conn.execute('SELECT set_config($1, $2, true)', f'app.{name}', str(value) if value is not None else '')


async def audit(conn, request, action, staff=None, role_id=None, row=None, **changes):
    record = row or {}
    await conn.execute('''INSERT INTO audit_log
        (action,user_id,role_id,type_id,record_reference,school_id,department_id,academic_year_id,
         ip_address,device_or_browser,session_id,field_changed,old_value,new_value,status_before,status_after)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)''',
        action, staff.id if staff else changes.get('user_id'), role_id, record.get('type_id'), record.get('id'),
        record.get('school_id'), record.get('department_id'), record.get('academic_year_id'),
        client_ip(request), request.headers.get('user-agent', '')[:512], staff.session_id if staff else None,
        changes.get('field'), changes.get('old'), changes.get('new'), changes.get('before'), changes.get('after'))
