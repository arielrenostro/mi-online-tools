from __future__ import annotations
import dataclasses
from app.core.contracts.tuning_input import TuningConfig


def default_config() -> dict:
    return dataclasses.asdict(TuningConfig())


def config_from_dict(d: dict) -> TuningConfig:
    known = {f.name for f in dataclasses.fields(TuningConfig)}
    filtered = {k: v for k, v in d.items() if k in known}
    return TuningConfig(**filtered)
