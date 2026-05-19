from __future__ import annotations
import os
from pathlib import Path
from app.models.datalog_model import DatalogModel

CACHE_DIR = Path(os.environ.get("MFT_CACHE_DIR", "/tmp/mft_datalogs"))


class DatalogDiskStore:

    def __init__(self) -> None:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _path(self, hash_str: str) -> Path:
        hex_part = hash_str.split(":", 1)[-1]
        return CACHE_DIR / f"{hex_part}.json"

    def exists(self, hash_str: str) -> bool:
        return self._path(hash_str).exists()

    def get(self, hash_str: str) -> DatalogModel:
        path = self._path(hash_str)
        if not path.exists():
            raise KeyError(hash_str)
        path.touch()
        return DatalogModel.model_validate_json(path.read_text(encoding="utf-8"))

    def save(self, hash_str: str, model: DatalogModel) -> None:
        self._path(hash_str).write_text(model.model_dump_json(), encoding="utf-8")

    def touch(self, hash_str: str) -> None:
        path = self._path(hash_str)
        if path.exists():
            path.touch()
