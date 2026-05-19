from __future__ import annotations
from typing import Any
from pydantic import BaseModel


class EngineInfo(BaseModel):
    engine_id:       str
    name:            str
    description:     str
    objective:       str
    target_map_type: str
    default_config:  dict[str, Any]
    config_schema:   dict[str, Any]


class TimeRange(BaseModel):
    start_ms: int
    end_ms:   int


class TuningRunRequest(BaseModel):
    engine_id:       str
    rpm_breakpoints: list[int]
    map_breakpoints: list[int]
    cells:           list[list[int]]
    log_hashes:      list[str]
    time_range:      TimeRange | None = None
    config:          dict[str, Any]   = {}
