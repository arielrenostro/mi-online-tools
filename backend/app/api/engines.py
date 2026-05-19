from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from app.core.interfaces.engine_registry import AbstractEngineRegistry
from app.models.engine_model import EngineInfo

router = APIRouter(prefix="/api/engines", tags=["engines"])


def _to_info(engine) -> EngineInfo:
    return EngineInfo(
        engine_id       = engine.engine_id,
        name            = engine.name,
        description     = engine.description,
        objective       = engine.objective,
        target_map_type = engine.target_map_type.value,
        default_config  = engine.get_default_config(),
        config_schema   = engine.get_config_schema(),
    )


@router.get("", response_model=list[EngineInfo])
def list_engines(registry: AbstractEngineRegistry = Depends(AbstractEngineRegistry)):
    return [_to_info(e) for e in registry.list_all()]


@router.get("/{engine_id}", response_model=EngineInfo)
def get_engine(engine_id: str, registry: AbstractEngineRegistry = Depends(AbstractEngineRegistry)):
    try:
        return _to_info(registry.get(engine_id))
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Engine '{engine_id}' não encontrado")
