from __future__ import annotations
from abc import ABC, abstractmethod
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.core.contracts.tuning_input import TuningInput
    from app.core.contracts.tuning_output import TuningOutput


class MapType(str, Enum):
    FUEL_VE  = "fuel_ve"
    IGNITION = "ignition"
    LAMBDA   = "lambda"
    BOOST    = "boost"


class TuningEngine(ABC):

    @property
    @abstractmethod
    def engine_id(self) -> str: ...

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @property
    @abstractmethod
    def objective(self) -> str: ...

    @property
    @abstractmethod
    def target_map_type(self) -> MapType: ...

    @abstractmethod
    def get_default_config(self) -> dict[str, Any]: ...

    @abstractmethod
    def get_config_schema(self) -> dict[str, Any]: ...

    @abstractmethod
    def run(self, input: "TuningInput") -> "TuningOutput": ...
