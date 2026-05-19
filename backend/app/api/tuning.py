from __future__ import annotations
from dataclasses import asdict
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from app.core.contracts.tuning_input import TuningInput, TuningConfig, DatalogRow
from app.core.interfaces.engine_registry import AbstractEngineRegistry
from app.datalog.disk_store import DatalogDiskStore
from app.engines.ve_lambda.config import config_from_dict
from app.models.engine_model import TuningRunRequest

router = APIRouter(prefix="/api/tuning", tags=["tuning"])


def get_store() -> DatalogDiskStore:
    return DatalogDiskStore()


def _output_to_dict(output) -> dict[str, Any]:
    from app.core.contracts.tuning_output import TuningOutput
    d = asdict(output)
    # Convert tuple keys in cells_no_data to lists for JSON serialisation
    d["cells_no_data"] = [list(t) for t in d["cells_no_data"]]
    d["monotonicity_warnings"] = [list(t) for t in d["monotonicity_warnings"]]
    return d


@router.post("/run")
def run_tuning(
    req:      TuningRunRequest,
    registry: AbstractEngineRegistry = Depends(AbstractEngineRegistry),
    store:    DatalogDiskStore       = Depends(get_store),
):
    # Resolve engine
    try:
        engine = registry.get(req.engine_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Engine '{req.engine_id}' não encontrado")

    # Load logs — collect missing hashes first
    missing: list[str] = [h for h in req.log_hashes if not store.exists(h)]
    if missing:
        raise HTTPException(
            status_code=404,
            detail={"detail": "Logs não encontrados no disco", "missing_hashes": missing},
        )

    # Gather rows from all requested logs, applying time_range
    all_rows: list[DatalogRow] = []
    time_offset_ms = 0

    for hash_str in req.log_hashes:
        model = store.get(hash_str)  # also touches mtime

        for r in model.rows:
            abs_ts = r.timestamp_ms + time_offset_ms

            if req.time_range is not None:
                if abs_ts < req.time_range.start_ms or abs_ts > req.time_range.end_ms:
                    continue

            all_rows.append(DatalogRow(
                timestamp_ms    = abs_ts,
                rpm             = r.rpm,
                map_kpa         = r.map_kpa,
                lambda1         = r.lambda1,
                lambda_correcao = r.lambda_correcao,
                lambda_target   = r.lambda_target,
                ve_value_raw    = r.ve_value_raw,
                clt             = r.clt,
                lambda_loop     = r.lambda_loop,
                pedal           = r.pedal,
            ))

        time_offset_ms += model.duration_ms

    if not all_rows:
        raise HTTPException(status_code=422, detail="Nenhuma linha de dados no intervalo de tempo selecionado.")

    # Build config
    try:
        cfg = config_from_dict(req.config)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Configuração inválida: {exc}")

    tuning_input = TuningInput(
        current_map     = req.cells,
        rpm_breakpoints = req.rpm_breakpoints,
        map_breakpoints = req.map_breakpoints,
        datalog_rows    = all_rows,
        config          = cfg,
    )

    try:
        output = engine.run(tuning_input)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro no tuning engine: {exc}")

    return _output_to_dict(output)
