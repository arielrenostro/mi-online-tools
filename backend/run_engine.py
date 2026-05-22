"""
Test runner — executes the VE Lambda engine pipeline against local CSV files.
Optionally compares the suggested map against a manually tuned reference map.

Usage: python run_engine.py
"""
from __future__ import annotations
import sys
import os

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

# Optional: path to a manually tuned map for comparison; set to "" to skip.
REFERENCE_MAP_FILE: str = "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection/Mapas/4bar - 33 - Download ecu_tuned.csv"

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
# Comparison against a reference (manually tuned) map
# ---------------------------------------------------------------------------

def print_comparison(
    suggested_map: list[list[int]],
    reference_map: list[list[int]],
    rpm_bps: list[int],
    map_bps: list[int],
    sample_count_map: list[list[int]],
) -> None:
    n_map = len(suggested_map)
    n_rpm = len(suggested_map[0]) if suggested_map else 0

    diffs: list[list[int]] = []
    pct_diffs: list[list[float]] = []
    flat_diffs: list[int] = []
    flat_pct: list[float] = []
    covered_diffs: list[int] = []
    covered_pct: list[float] = []

    for i in range(n_map):
        row_d: list[int] = []
        row_p: list[float] = []
        for j in range(n_rpm):
            s = suggested_map[i][j]
            r = reference_map[i][j]
            d = s - r
            p = (s - r) / r * 100 if r != 0 else 0.0
            row_d.append(d)
            row_p.append(p)
            flat_diffs.append(d)
            flat_pct.append(p)
            if sample_count_map[i][j] > 0:
                covered_diffs.append(d)
                covered_pct.append(p)
        diffs.append(row_d)
        pct_diffs.append(row_p)

    def _stats(values: list, label: str) -> None:
        if not values:
            print(f"  {label}: (sem dados)")
            return
        mean_v = sum(values) / len(values)
        abs_values = [abs(v) for v in values]
        mean_abs = sum(abs_values) / len(abs_values)
        max_abs = max(abs_values)
        within_1pct = sum(1 for v in values if abs(v) <= 1.0)
        within_5pct = sum(1 for v in values if abs(v) <= 5.0)
        print(f"  {label}:")
        print(f"    Média            : {mean_v:+.2f}")
        print(f"    Média |desvio|   : {mean_abs:.2f}")
        print(f"    Máx  |desvio|   : {max_abs:.2f}")
        print(f"    Dentro de ±1%   : {within_1pct}/{len(values)} células ({within_1pct/len(values)*100:.0f}%)")
        print(f"    Dentro de ±5%   : {within_5pct}/{len(values)} células ({within_5pct/len(values)*100:.0f}%)")

    total_cells = n_map * n_rpm
    print("\n=== COMPARISON: SUGGESTED vs REFERENCE ===")
    print(f"  Células totais   : {total_cells}")
    print(f"  Células com dados: {len(covered_diffs)}")
    print()
    _stats(flat_pct, "Todas as células (%)")
    print()
    _stats(covered_pct, "Células com dados (%)")

    print("\n=== DIFF MAP: sugerido − referência (raw) ===")
    _print_matrix(diffs, fmt=lambda v: f"{v:+5d}")

    print("\n=== DIFF MAP: sugerido − referência (%) ===")
    _print_matrix(pct_diffs, fmt=lambda v: f"{v:+5.1f}")

    print("\n=== TOP 10 maiores desvios (sugerido vs referência) ===")
    cells_sorted = sorted(
        [(abs(pct_diffs[i][j]), i, j, diffs[i][j], pct_diffs[i][j])
         for i in range(n_map) for j in range(n_rpm)],
        reverse=True,
    )[:10]
    print(f"  {'MAP(kPa)':>10}  {'RPM':>6}  {'Sugerido':>10}  {'Ref':>10}  {'Δ raw':>7}  {'Δ %':>7}  {'Amostras':>8}")
    for _, i, j, d, p in cells_sorted:
        print(f"  {map_bps[i]:>10}  {rpm_bps[j]:>6}  {suggested_map[i][j]:>10}  {reference_map[i][j]:>10}  {d:>+7}  {p:>+7.1f}%  {sample_count_map[i][j]:>8}")


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

    if REFERENCE_MAP_FILE:
        print(f"\nParsing reference map: {REFERENCE_MAP_FILE}")
        _, _, ref_cells = parse_map(REFERENCE_MAP_FILE)
        print_comparison(
            suggested_map    = output.suggested_map,
            reference_map    = ref_cells,
            rpm_bps          = rpm_bps,
            map_bps          = map_bps,
            sample_count_map = output.sample_count_map,
        )


if __name__ == "__main__":
    main()
