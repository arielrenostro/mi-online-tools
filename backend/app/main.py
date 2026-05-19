from __future__ import annotations
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.interfaces.engine_registry import AbstractEngineRegistry
from app.registry.default_registry import DefaultEngineRegistry
from app.engines.ve_lambda.engine import VELambdaEngine
from app.datalog.cleanup import cleanup_loop
from app.api import engines, datalog, tuning

# Bootstrap registry
_registry = DefaultEngineRegistry()
_registry.register(VELambdaEngine())

app = FastAPI(title="Master Injection Online Tools", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency injection: routes receive AbstractEngineRegistry, resolved to _registry
app.dependency_overrides[AbstractEngineRegistry] = lambda: _registry

app.include_router(engines.router)
app.include_router(datalog.router)
app.include_router(tuning.router)


@app.on_event("startup")
async def start_cleanup() -> None:
    asyncio.create_task(cleanup_loop())


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
