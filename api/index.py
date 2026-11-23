import asyncpg
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse

from backend import admin, auth, records, reports
from backend.db import CATALOG, LOG, ROOT, TYPES, lifespan

app = FastAPI(title='Pillai Accreditation API', version='2.0', docs_url='/api/docs', redoc_url=None,
              openapi_url='/api/openapi.json', swagger_ui_oauth2_redirect_url=None, lifespan=lifespan)

for router in (auth.router, admin.router, records.router, reports.router):
    app.include_router(router)


@app.middleware('http')
async def response_headers(request: Request, call_next):
    if request.method in ('POST','PATCH','PUT','DELETE'):
        raw = request.headers.get('content-length')
        if raw and (not raw.isdigit() or len(raw)>8 or int(raw)>4_200_000):
            return JSONResponse({'detail':'The request is too large.'},status_code=413)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    if request.url.path not in ('/api/catalog','/api/schema','/api/docs','/api/openapi.json'):
        response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({'detail': [{'loc':item['loc'],'msg':item['msg']} for item in exc.errors()]},status_code=422)


@app.exception_handler(asyncpg.PostgresError)
async def database_error(request, exc):
    if isinstance(exc, asyncpg.UniqueViolationError):
        return JSONResponse({'detail':'An item with these values already exists.'},status_code=409)
    if isinstance(exc, asyncpg.ForeignKeyViolationError):
        return JSONResponse({'detail':'The item references a missing record or is used by another record.'},status_code=409)
    if isinstance(exc, (asyncpg.CheckViolationError,asyncpg.NotNullViolationError,asyncpg.DataError)):
        return JSONResponse({'detail':'The values do not satisfy the database constraints.'},status_code=422)
    if isinstance(exc, (asyncpg.UndefinedTableError, asyncpg.InvalidSchemaNameError, asyncpg.InvalidPasswordError,asyncpg.PostgresConnectionError)):
        return JSONResponse({'detail':'PostgreSQL or the accreditation schema is not ready.'},status_code=503)
    if isinstance(exc,(asyncpg.SerializationError,asyncpg.DeadlockDetectedError)):
        return JSONResponse({'detail':'The record changed while you were working. Reload and retry.'},status_code=409)
    LOG.error('Accreditation database request failed: %s', type(exc).__name__)
    return JSONResponse({'detail':'The operation could not be completed.'},status_code=500)


@app.get('/api/status', tags=['System'])
async def status(request: Request):
    pool = getattr(request.app.state,'pool',None)
    if pool is None:
        return {'status': 'unavailable' if getattr(request.app.state,'database_configured',False) else 'not_configured'}
    try:
        async with pool.acquire(timeout=5) as conn:
            ready = await conn.fetchval("SELECT to_regclass('accreditation.staff_credentials') IS NOT NULL AND to_regclass('accreditation.record_evidence') IS NOT NULL AND to_regclass('accreditation.audit_log') IS NOT NULL")
    except (asyncpg.PostgresError, OSError, ValueError, TimeoutError):
        return {'status': 'unavailable'}
    return {'status': 'ready' if ready else 'schema_missing'}


@app.get('/api/catalog', tags=['Field dictionary'])
def list_types(q: str = Query('', max_length=150)):
    return [r for r in CATALOG if q.casefold() in r['name'].casefold()]


@app.get('/api/catalog/{type_id}', tags=['Field dictionary'])
def record_definition(type_id: int):
    if type_id not in TYPES:
        raise HTTPException(404,'Unknown record type')
    return TYPES[type_id]


@app.get('/api/schema', tags=['Field dictionary'])
def schema():
    return FileResponse(ROOT/'public/accreditation.sql',filename='pillai-accreditation.sql',media_type='application/sql')
