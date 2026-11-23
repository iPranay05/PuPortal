import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from .access import GRANTS
from .db import audit, client_ip, connection

router = APIRouter(prefix='/api/auth', tags=['Staff authentication'])
bearer = HTTPBearer(auto_error=False)
ACTIVE = '''u.account_status='Active' AND (u.joining_date IS NULL OR u.joining_date <= CURRENT_DATE)
    AND (u.leaving_date IS NULL OR u.leaving_date >= CURRENT_DATE)'''


class Login(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra='forbid')
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


@dataclass
class Staff:
    id: int
    name: str
    email: str
    school_id: Optional[int]
    department_id: Optional[int]
    needs_reset: bool
    token_hash: str
    session_id: str
    grants: list


def password_digest(password, salt):
    return hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64*1024*1024).hex()


def hash_password(password):
    salt = secrets.token_bytes(16)
    return f'{salt.hex()}:{password_digest(password, salt)}'


def verify_password(password, stored):
    if stored:
        salt, digest = stored.split(':', 1)
    else:
        salt, digest = '00' * 16, '00' * 64
    return hmac.compare_digest(password_digest(password, bytes.fromhex(salt)), digest) and bool(stored)


def digest_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def profile(staff):
    return {'id': staff.id, 'name': staff.name, 'email': staff.email, 'school_id': staff.school_id,
            'department_id': staff.department_id, 'password_reset_required': staff.needs_reset,
            'roles': sorted({grant['name'] for grant in staff.grants}),
            'add_types': sorted({int(type_id) for grant in staff.grants for type_id, flags in grant['permissions'].items()
                                 if grant['name'] not in ('Reviewer','IQAC Member') and flags.get('can_add')})}


async def current_staff(credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer), conn=Depends(connection)):
    if credentials is None or len(credentials.credentials) != 43:
        raise HTTPException(401, 'Sign in with a staff account.', headers={'WWW-Authenticate': 'Bearer'})
    token_hash = digest_token(credentials.credentials)
    row = await conn.fetchrow(f'''SELECT u.id, concat_ws(' ',u.first_name,u.last_name) AS name, u.official_email,
        u.school_id, u.department_id, u.password_reset_required
        FROM staff_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>now() AND {ACTIVE}''', token_hash)
    if row is None:
        raise HTTPException(401, 'Your session has expired. Sign in again.', headers={'WWW-Authenticate': 'Bearer'})
    return Staff(row['id'], row['name'], row['official_email'], row['school_id'], row['department_id'],
                 bool(row['password_reset_required']), token_hash, digest_token('audit:' + token_hash)[:20],
                 await conn.fetch(GRANTS,row['id']))


async def require_staff(staff=Depends(current_staff)):
    if staff.needs_reset:
        raise HTTPException(403, 'Change your password before opening accreditation records.')
    return staff


RATE_LIMIT = '''INSERT INTO sign_in_limits(bucket,attempts,expires_at) VALUES ($1,1,now()+interval '15 minutes')
    ON CONFLICT (bucket) DO UPDATE SET
      attempts=CASE WHEN sign_in_limits.expires_at <= now() THEN 1 ELSE least(sign_in_limits.attempts+1,201) END,
      expires_at=CASE WHEN sign_in_limits.expires_at <= now() THEN excluded.expires_at ELSE sign_in_limits.expires_at END
    RETURNING attempts'''


@router.post('/login')
async def login(data: Login, request: Request, conn=Depends(connection)):
    email = data.email.strip().lower()
    email_bucket = 'email:' + digest_token(email)
    ip_bucket = 'ip:' + str(client_ip(request) or 'unknown')
    if await conn.fetchval(RATE_LIMIT, ip_bucket) > 200 or await conn.fetchval(RATE_LIMIT, email_bucket) > 6:
        raise HTTPException(429, 'Too many sign-in attempts. Try again in 15 minutes.', headers={'Retry-After': '900'})
    row = await conn.fetchrow(f'''SELECT u.id, c.password_hash FROM users u JOIN staff_credentials c ON c.user_id=u.id
        WHERE lower(u.official_email)=$1 AND {ACTIVE}''', email)
    if not await run_in_threadpool(verify_password, data.password, row['password_hash'] if row else None):
        await audit(conn, request, 'Failed Login', user_id=row['id'] if row else None)
        raise HTTPException(401, 'The email or password did not match.')
    token = secrets.token_urlsafe(32)
    token_hash = digest_token(token)
    async with conn.transaction():
        authorized = await conn.fetchval(f'''SELECT u.id FROM users u JOIN staff_credentials c ON c.user_id=u.id
            WHERE u.id=$1 AND c.password_hash=$2 AND {ACTIVE} FOR UPDATE OF u''', row['id'], row['password_hash'])
        if not authorized:
            raise HTTPException(401, 'The email or password did not match.')
        await conn.execute('UPDATE users SET last_login=now() WHERE id=$1', row['id'])
        await conn.execute('DELETE FROM staff_sessions WHERE user_id=$1 AND expires_at <= now()', row['id'])
        await conn.execute('DELETE FROM sign_in_limits WHERE bucket=$1', email_bucket)
        await conn.execute("INSERT INTO staff_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
                           token_hash, row['id'])
        await audit(conn, request, 'Login', Staff(row['id'], '', email, None, None, False, token_hash,
                                                 digest_token('audit:' + token_hash)[:20], []))
    return {'access_token': token, 'token_type': 'bearer', 'expires_in': 28800}


@router.get('/me')
async def me(staff=Depends(current_staff)):
    return profile(staff)


@router.post('/logout', status_code=204)
async def logout(staff=Depends(current_staff), conn=Depends(connection)):
    await conn.execute('DELETE FROM staff_sessions WHERE token_hash=$1', staff.token_hash)
    return Response(status_code=204)


@router.post('/password', status_code=204)
async def change_password(data: PasswordChange, request: Request, staff=Depends(current_staff), conn=Depends(connection)):
    if data.current_password == data.new_password:
        raise HTTPException(422, 'Choose a different password.')
    digest = await conn.fetchval('SELECT password_hash FROM staff_credentials WHERE user_id=$1', staff.id)
    if not await run_in_threadpool(verify_password, data.current_password, digest):
        raise HTTPException(401, 'The current password did not match.')
    password_hash = await run_in_threadpool(hash_password, data.new_password)
    async with conn.transaction():
        await conn.fetchval('SELECT id FROM users WHERE id=$1 FOR UPDATE', staff.id)
        changed = await conn.fetchval('UPDATE staff_credentials SET password_hash=$1 WHERE user_id=$2 AND password_hash=$3 RETURNING user_id',
                                      password_hash, staff.id, digest)
        if not changed:
            raise HTTPException(409, 'The password was changed in another session.')
        await conn.execute('UPDATE users SET password_reset_required=false, edited_by=$1, edited_on=now() WHERE id=$1', staff.id)
        await conn.execute('DELETE FROM staff_sessions WHERE user_id=$1', staff.id)
        await audit(conn, request, 'Edited', staff, field='password_changed')
    return Response(status_code=204)
