"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import lifespan
from .auth import router as auth_router
from .admin import router as admin_router
from .records import router as records_router
from .reports import router as reports_router

app = FastAPI(
    title='PUPortal Accreditation API',
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(records_router)
app.include_router(reports_router)


@app.get('/api/health')
async def health():
    return {'status': 'ok'}

