from __future__ import annotations
from abc import ABC, abstractmethod
from app.core.interfaces.tuning_engine import TuningEngine


class AbstractEngineRegistry(ABC):

    @abstractmethod
    def register(self, engine: TuningEngine) -> None: ...

    @abstractmethod
    def get(self, engine_id: str) -> TuningEngine: ...

    @abstractmethod
    def list_all(self) -> list[TuningEngine]: ...
