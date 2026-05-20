"""
Test runner — executes the VE Lambda engine pipeline against local CSV files.
Usage: python run_engine.py
"""
from __future__ import annotations
import sys
import os
import pprint

# Make sure imports resolve from the backend root
sys.path.insert(0, os.path.dirname(__file__))

from app.parsers.datalog_parser import parse_datalog
from app.core.contracts.tuning_input import DatalogRow, TuningConfig, TuningInput
from app.engines.ve_lambda.engine import VELambdaEngine

# ---------------------------------------------------------------------------
# INPUT — edit these paths
# ---------------------------------------------------------------------------

LOG_FILES: list[str] = [
     "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Datalogs/dash/log_stream_20260517_141252 - volta lauro.csv",
     "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Datalogs/dash/log_stream_20260517_060432 - subida serra.csv",
     "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Datalogs/dash/log_stream_20260516_155239.csv",
     "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Datalogs/dash/log_stream_20260514_221657 - ida lauro.csv",
]

MAP_FILE: str = "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Mapas/4bar - 28 - Download ecu.csv"

# ---------------------------------------------------------------------------
# Map parser (mirrors the client-side TypeScript parser)
# ---------------------------------------------------------------------------

def parse_map(path: str) -> tuple[list[int], list[int], list[list[int]]]:
    """Returns (rpm_breakpoints, map_breakpoints, cells)."""
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()

    rpm_bps: list[int] = []
    map_bps: list[int] = []
    cells_by_idx: dict[int, list[int]] = {}

    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        tag   = parts[0].strip()

        if tag == "#I20":
            rpm_bps = [int(v) for v in parts[1:] if v.strip()]
        elif tag == "#I21":
            map_bps = [int(v) for v in parts[1:] if v.strip()]
        elif tag.startswith("#F") and len(tag) == 4:
            idx = int(tag[2:]) - 1   # 1-based → 0-based
            cells_by_idx[idx] = [int(v) for v in parts[1:] if v.strip()]

    if not rpm_bps or not map_bps:
        raise ValueError(f"Breakpoints #I20/#I21 não encontrados em {path}")
    if not cells_by_idx:
        raise ValueError(f"Nenhuma linha #F01-#F16 encontrada em {path}")

    n_map = len(map_bps)
    cells = [cells_by_idx.get(i, []) for i in range(n_map)]
    return rpm_bps, map_bps, cells


# ---------------------------------------------------------------------------
# DatalogRowModel → DatalogRow conversion
# ---------------------------------------------------------------------------

def to_datalog_row(r) -> DatalogRow:
    return DatalogRow(
        timestamp_ms    = r.timestamp_ms,
        rpm             = r.rpm,
        map_kpa         = r.map_kpa,
        lambda1         = r.lambda1,
        lambda_correcao = r.lambda_correcao,
        lambda_target   = r.lambda_target,
        ve_value_raw    = r.ve_value_raw,
        clt             = r.clt,
        lambda_loop     = r.lambda_loop,
        pedal           = r.pedal,
    )


# ---------------------------------------------------------------------------
# Output printer
# ---------------------------------------------------------------------------

def print_output(output) -> None:
    fs = output.filter_stats
    print("\n=== FILTER STATS ===")
    print(f"  Total rows : {fs.total_rows}")
    print(f"  Passed     : {fs.passed}")
    print(f"  Discarded  : {fs.total_rows - fs.passed}")
    disc = {
        "clt"          : fs.discarded_clt,
        "open_loop"    : fs.discarded_open_loop,
        "skip_cl"      : fs.discarded_skip_cl,
        "skip_rpm_bkt" : fs.discarded_skip_rpm_bkt,
        "skip_map_bkt" : fs.discarded_skip_map_bkt,
        "delta_rpm"    : fs.discarded_delta_rpm,
        "delta_map"    : fs.discarded_delta_map,
        "delta_lambda" : fs.discarded_delta_lambda,
        "max_lambda"   : fs.discarded_max_lambda,
        "delta_pedal"  : fs.discarded_delta_pedal,
        "out_of_range" : fs.discarded_out_of_range,
        "outlier"      : fs.discarded_outlier,
    }
    for reason, count in disc.items():
        if count:
            print(f"    {reason:<15}: {count}")

    print("\n=== CELLS WITH DATA ===")
    cells_with_data = [
        (i, j)
        for i, row in enumerate(output.sample_count_map)
        for j, n in enumerate(row)
        if n > 0
    ]
    print(f"  {len(cells_with_data)} cells covered")

    print("\n=== CORRECTION SUMMARY (cells with data) ===")
    corrections = [
        output.correction_pct_map[i][j]
        for i, j in cells_with_data
    ]
    if corrections:
        print(f"  Min  : {min(corrections):+.2f}%")
        print(f"  Max  : {max(corrections):+.2f}%")
        print(f"  Mean : {sum(corrections)/len(corrections):+.2f}%")

    print("\n=== CONVERGENCE ===")
    converged = sum(
        1
        for i, row in enumerate(output.convergence_map)
        for j, v in enumerate(row)
        if v is True
    )
    total_with_data = len(cells_with_data)
    print(f"  Converged: {converged}/{total_with_data} cells")

    print("\n=== CELLS EXTRAPOLATED ===")
    by_rule: dict[str, int] = {}
    for ce in output.cells_extrapolated:
        by_rule[ce.rule] = by_rule.get(ce.rule, 0) + 1
    for rule, count in by_rule.items():
        print(f"  {rule}: {count}")

    print("\n=== WARNINGS ===")
    print(f"  Monotonicity : {len(output.monotonicity_warnings)}")
    print(f"  Gradient     : {len(output.gradient_warnings)}")

    print("\n=== CORRECTION MAP (%) ===")
    _print_matrix(output.correction_pct_map, fmt=lambda v: f"{v:+5.1f}")

    print("\n=== SAMPLE COUNT MAP ===")
    _print_matrix(output.sample_count_map, fmt=lambda v: f"{v:5d}")

    print("\n=== CONFIDENCE MAP ===")
    _print_matrix(output.confidence_map, fmt=lambda v: f"{v:.2f}" if v is not None else "  -- ")

    print("\n=== SUGGESTED MAP ===")
    _print_matrix(output.suggested_map, fmt=lambda v: f"{v:5d}")


def _print_matrix(matrix, fmt) -> None:
    for i, row in enumerate(reversed(matrix)):
        row_str = "  ".join(fmt(v) for v in row)
        print(f"  row {len(matrix)-1-i:2d}: {row_str}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not LOG_FILES:
        print("ERROR: LOG_FILES está vazio. Edite run_engine.py e adicione os caminhos dos CSVs.")
        sys.exit(1)
    if not MAP_FILE:
        print("ERROR: MAP_FILE está vazio. Edite run_engine.py e adicione o caminho do CSV do mapa.")
        sys.exit(1)

    # Parse map
    print(f"Parsing map: {MAP_FILE}")
    rpm_bps, map_bps, cells = parse_map(MAP_FILE)
    print(f"  {len(rpm_bps)} RPM breakpoints × {len(map_bps)} MAP breakpoints")

    # Parse logs
    all_rows: list[DatalogRow] = []
    ts_offset = 0
    for path in LOG_FILES:
        print(f"Parsing log: {path}")
        content  = open(path, "rb").read()
        filename = os.path.basename(path)
        model    = parse_datalog(content, filename, f"sha1:{filename}")
        rows     = [to_datalog_row(r) for r in model.rows]
        # Offset timestamps so multiple logs don't overlap
        for r in rows:
            r.timestamp_ms += ts_offset
        ts_offset += (rows[-1].timestamp_ms if rows else 0) + 1
        all_rows.extend(rows)
        print(f"  {len(rows)} rows parsed")

    print(f"\nTotal datalog rows: {len(all_rows)}")

    # Build input and run engine
    tuning_input = TuningInput(
        current_map     = cells,
        rpm_breakpoints = rpm_bps,
        map_breakpoints = map_bps,
        datalog_rows    = all_rows,
        config          = TuningConfig(),
    )

    print("\nRunning VE Lambda engine...")
    engine = VELambdaEngine()
    output = engine.run(tuning_input)

    print_output(output)


if __name__ == "__main__":
    main()
