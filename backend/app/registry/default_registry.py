from __future__ import annotations
from app.core.interfaces.tuning_engine import TuningEngine
from app.core.interfaces.engine_registry import AbstractEngineRegistry


class DefaultEngineRegistry(AbstractEngineRegistry):

    def __init__(self) -> None:
        self._engines: dict[str, TuningEngine] = {}

    def register(self, engine: TuningEngine) -> None:
        if engine.engine_id in self._engines:
            raise ValueError(f"Engine '{engine.engine_id}' já registrado")
        self._engines[engine.engine_id] = engine

    def get(self, engine_id: str) -> TuningEngine:
        if engine_id not in self._engines:
            raise KeyError(f"Engine '{engine_id}' não encontrado")
        return self._engines[engine_id]

    def list_all(self) -> list[TuningEngine]:
        return list(self._engines.values())
