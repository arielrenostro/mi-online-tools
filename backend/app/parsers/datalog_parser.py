from __future__ import annotations
from app.models.datalog_model import DatalogModel, DatalogRowModel

_REQUIRED = {"RPM", "MAP", "Lambda 1", "VE Value", "CLT", "Lambda Loop", "Lambda Target", "Lambda Corr"}
_SIGNALS  = ["RPM", "MAP", "Lambda 1", "Lambda Target", "CLT", "Lambda Corr", "Lambda Loop"]


def parse_datalog(content: bytes, filename: str, hash_str: str) -> DatalogModel:
    text  = content.decode("utf-8", errors="replace")
    lines = text.splitlines()

    col_map: dict[str, int] = {}
    has_timestamp_col = False
    raw_rows: list[DatalogRowModel] = []
    first_ts: int | None = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        fields = line.split(";")

        if fields[0].strip() == "Timestamp":
            col_map = {name.strip(): idx for idx, name in enumerate(fields)}
            has_timestamp_col = "Timestamp" in col_map
            missing = _REQUIRED - col_map.keys()
            if missing:
                raise ValueError(f"Colunas obrigatórias ausentes: {missing}")
            continue

        if not col_map:
            continue

        if len(fields) < len(col_map):
            continue

        if has_timestamp_col:
            try:
                raw_ts = int(fields[col_map["Timestamp"]].strip())
            except (ValueError, IndexError):
                continue
        else:
            raw_ts = len(raw_rows) * 100

        try:
            rpm         = float(fields[col_map["RPM"]].strip())
            map_kpa     = float(fields[col_map["MAP"]].strip())
            lambda1_r   = float(fields[col_map["Lambda 1"]].strip())
            ve_raw      = int(fields[col_map["VE Value"]].strip())
            clt_raw     = int(fields[col_map["CLT"]].strip())
            ll          = int(fields[col_map["Lambda Loop"]].strip())
            lt_r        = float(fields[col_map["Lambda Target"]].strip())
            lc_r        = float(fields[col_map["Lambda Corr"]].strip())
        except (ValueError, IndexError, KeyError):
            continue

        pedal: float | None = None
        if "ACC %" in col_map:
            try:
                acc_raw = float(fields[col_map["ACC %"]].strip())
                pedal   = min(100.0, acc_raw / 990.0 * 100.0)
            except (ValueError, IndexError):
                pass

        if first_ts is None:
            first_ts = raw_ts if has_timestamp_col else 0

        raw_rows.append(DatalogRowModel(
            timestamp_ms    = raw_ts - first_ts,
            rpm             = rpm,
            map_kpa         = map_kpa,
            lambda1         = lambda1_r / 1000.0,
            lambda_correcao = lc_r / 1000.0,
            lambda_target   = lt_r / 1000.0,
            ve_value_raw    = ve_raw,
            clt             = float(clt_raw - 273),
            lambda_loop     = ll,
            pedal           = pedal,
        ))

    if not raw_rows:
        raise ValueError("Nenhuma linha de dados válida encontrada no CSV.")

    duration_ms = raw_rows[-1].timestamp_ms

    signals = list(_SIGNALS)
    if any(r.pedal is not None for r in raw_rows):
        signals.append("Pedal")

    return DatalogModel(
        hash        = hash_str,
        filename    = filename,
        duration_ms = duration_ms,
        signals     = signals,
        rows        = raw_rows,
    )
