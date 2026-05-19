from __future__ import annotations
from pydantic import BaseModel


class DatalogRowModel(BaseModel):
    timestamp_ms:    int
    rpm:             float
    map_kpa:         float
    lambda1:         float
    lambda_correcao: float
    lambda_target:   float
    ve_value_raw:    int
    clt:             float
    lambda_loop:     int
    pedal:           float | None = None


class DatalogModel(BaseModel):
    hash:        str
    filename:    str
    duration_ms: int
    signals:     list[str]
    rows:        list[DatalogRowModel]


class DatalogUploadResponse(DatalogModel):
    cached: bool
