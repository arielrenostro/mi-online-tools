"""
PoC — sandbox isolado para diagnosticar e corrigir o algoritmo de tuning VE.

Objetivo: validar o comportamento e iterar na correcao SEM tocar no projeto
principal (specs/engine permanecem intactos). Quando o algoritmo do PoC
estiver validado, traduzimos para o projeto.

Reusa do projeto (camadas que NAO sao o problema):
    parsing de datalog, Filter, Snap, Formula, Aggregator, Confidence
Reimplementa aqui (camada EDITAVEL — onde mora o problema):
    solve_field()  — campo de VE ancorado nos dados

Uso:
    cd backend && source venv/bin/activate && python poc/poc.py
"""
from __future__ import annotations
import os
import sys
import numpy as np

_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from app.parsers.datalog_parser import parse_datalog
from app.core.contracts.tuning_input import DatalogRow, TuningConfig, TuningInput
from app.engines.ve_lambda.engine import VELambdaEngine
from app.engines.ve_lambda.pipeline.filter import Filter
from app.engines.ve_lambda.pipeline.snap import Snap
from app.engines.ve_lambda.pipeline.formula import Formula
from app.engines.ve_lambda.pipeline.aggregator import Aggregator
from app.engines.ve_lambda.pipeline.confidence import Confidence

# ===========================================================================
# INPUT
# ===========================================================================
BASE = "/mnt/c/Users/ariel/OneDrive/Carros/206/Master Injection"
MAP_FILE = f"{BASE}/Mapas/4bar - 28 - Download ecu.csv"
REF_FILE = f"{BASE}/Mapas/4bar - 32 - VE manual, trip lauro mueler.csv"
LOG_FILES = [
    f"{BASE}/Datalogs/dash/log_stream_20260517_141252 - volta lauro.csv",
    f"{BASE}/Datalogs/dash/log_stream_20260517_060432 - subida serra.csv",
    f"{BASE}/Datalogs/dash/log_stream_20260516_155239.csv",
    f"{BASE}/Datalogs/dash/log_stream_20260514_221657 - ida lauro.csv",
]


# ===========================================================================
# Parsing do mapa (espelha o parser TypeScript client-side)
# ===========================================================================
def parse_map(path: str) -> tuple[list[int], list[int], list[list[int]]]:
    with open(path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    rpm_bps: list[int] = []
    map_bps: list[int] = []
    by_idx: dict[int, list[int]] = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        tag = parts[0].strip()
        if tag == "#I20":
            rpm_bps = [int(v) for v in parts[1:] if v.strip()]
        elif tag == "#I21":
            map_bps = [int(v) for v in parts[1:] if v.strip()]
        elif tag.startswith("#F") and len(tag) == 4:
            by_idx[int(tag[2:]) - 1] = [int(v) for v in parts[1:] if v.strip()]
    cells = [by_idx.get(i, []) for i in range(len(map_bps))]
    return rpm_bps, map_bps, cells


def to_row(r) -> DatalogRow:
    return DatalogRow(
        timestamp_ms=r.timestamp_ms, rpm=r.rpm, map_kpa=r.map_kpa,
        lambda1=r.lambda1, lambda_correcao=r.lambda_correcao,
        lambda_target=r.lambda_target, ve_value_raw=r.ve_value_raw,
        clt=r.clt, lambda_loop=r.lambda_loop, pedal=r.pedal,
    )


# ===========================================================================
# >>>>>>>>>>>>>>>>>>>>>>>  ALGORITMO EDITAVEL  <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
#
# Campo resolvido no VALOR de VE (nao no fator de correcao) com penalidade
# thin-plate (2a derivada). Minimiza:
#
#   E = Σ_ancoras W·(V - VE_medido)²       <- ancora o campo nos dados
#     + μ·Σ (V[j-1] - 2V[j] + V[j+1])²     <- 2a derivada na direcao RPM
#     + μ·Σ (V[i-1] - 2V[i] + V[i+1])²     <- 2a derivada na direcao MAP
#
# A 2a derivada tem as funcoes lineares no seu nucleo: onde NAO ha dados o
# campo vira uma RAMPA LINEAR extrapolada das ancoras — deixa de herdar o
# formato do mapa atual. O peso W cresce com amostras×estabilidade: celula
# confiavel = ancora forte (fonte da verdade); celula com poucas amostras =
# ancora fraca = segue os vizinhos confiaveis em vez de congelar o atual.
#
# Parametros para iterar:
#   _W_SCALE  — quanto menor, mais "confiavel" uma celula com poucas amostras
#   μ         — cfg.smoothing_strength; afeta so o balanco em ancoras fracas
# ===========================================================================
_W_SCALE = 50.0    # peso da ancora = count · stability_score / _W_SCALE


def solve_field(stats, current, rpm, mp, cfg):
    """Retorna (suggested_map, V_field, has_data). EDITAR AQUI para iterar."""
    n_map, n_rpm = len(mp), len(rpm)
    N = n_map * n_rpm
    mu = max(float(cfg.smoothing_strength), 1e-6)
    idx = lambda i, j: i * n_rpm + j

    A = np.zeros((N, N))
    b = np.zeros(N)

    # --- termo de ancora: V ~= VE medido, peso = confianca -------------------
    has_data: set[tuple[int, int]] = set()
    for (i, j), cs in stats.items():
        if current[i][j] == 0:
            continue
        w = cs.cell.count * cs.stability_score / _W_SCALE
        if w <= 0.0:
            continue
        k = idx(i, j)
        A[k, k] += w
        b[k]    += w * cs.cell.ve_lambda_avg
        has_data.add((i, j))

    if not has_data:
        return [row[:] for row in current], np.array(current, float), has_data

    # --- termo thin-plate: 2a derivada em RPM e em MAP -----------------------
    def add_triple(t: tuple[int, int, int]) -> None:
        coef = (1.0, -2.0, 1.0)
        for p in range(3):
            for q in range(3):
                A[t[p], t[q]] += mu * coef[p] * coef[q]

    for i in range(n_map):                       # 2a derivada ao longo de RPM
        for j in range(1, n_rpm - 1):
            add_triple((idx(i, j - 1), idx(i, j), idx(i, j + 1)))
    for j in range(n_rpm):                       # 2a derivada ao longo de MAP
        for i in range(1, n_map - 1):
            add_triple((idx(i - 1, j), idx(i, j), idx(i + 1, j)))

    V = np.linalg.solve(A, b).reshape(n_map, n_rpm)

    # --- montar mapa sugerido ------------------------------------------------
    max_pct = cfg.max_correction_pct / 100.0
    sug = [[0] * n_rpm for _ in range(n_map)]
    for i in range(n_map):
        for j in range(n_rpm):
            v = float(V[i][j])
            cur = current[i][j]
            # Clamp so nas celulas COM dados (protege contra medida ruidosa).
            # Celulas sem dados ficam livres = extrapolacao linear pura.
            if (i, j) in has_data and cur > 0:
                v = max(cur * (1.0 - max_pct), min(cur * (1.0 + max_pct), v))
            sug[i][j] = max(100, min(9999, int(round(v))))

    # --- pos-processamento: regra RPM 400 -----------------------------------
    if cfg.rpm400_rule_enabled and 400 in rpm and 800 in rpm:
        i400, i800 = rpm.index(400), rpm.index(800)
        for i in range(n_map):
            sug[i][i400] = int(round(sug[i][i800] * (1.0 - cfg.rpm400_discount)))

    # --- pos-processamento: regra MAP baixo ---------------------------------
    if cfg.low_map_rule_enabled:
        row_samples: dict[int, int] = {}
        for (i, j), cs in stats.items():
            row_samples[i] = row_samples.get(i, 0) + cs.cell.count
        for i, kpa in enumerate(mp):
            if kpa <= cfg.low_map_threshold and row_samples.get(i, 0) == 0 and i + 1 < n_map:
                for j in range(n_rpm):
                    sug[i][j] = int(round(sug[i + 1][j] * (1.0 - cfg.low_map_discount)))

    return sug, V, has_data


# ===========================================================================
# Diagnosticos
# ===========================================================================
def banner(title: str) -> None:
    print("\n" + "=" * 74)
    print(f"  {title}")
    print("=" * 74)


def vsref(M, ref, scount):
    """(|desvio| medio todas, max, |desvio| medio com dados, max, % <=5%)."""
    flat, cov = [], []
    for i in range(len(M)):
        for j in range(len(M[0])):
            r = ref[i][j]
            if not r:
                continue
            p = abs((M[i][j] - r) / r * 100.0)
            flat.append(p)
            if scount[i][j] > 0:
                cov.append(p)
    w5 = sum(1 for v in flat if v <= 5) * 100 // len(flat)
    return (sum(flat) / len(flat), max(flat),
            sum(cov) / len(cov), max(cov), w5)


def _roughness(M, i, j, n_map, n_rpm):
    """Aspereza local: media do |delta %| da celula vs vizinhos (4-conexo)."""
    acc, cnt = 0.0, 0
    for a, c in ((i - 1, j), (i + 1, j), (i, j - 1), (i, j + 1)):
        if 0 <= a < n_map and 0 <= c < n_rpm and M[a][c]:
            acc += abs(M[i][j] - M[a][c]) / M[a][c] * 100.0
            cnt += 1
    return acc / cnt if cnt else 0.0


def diagnose(sug, ref, cur, stats, rpm, mp):
    n_map, n_rpm = len(mp), len(rpm)
    scount = [[0] * n_rpm for _ in range(n_map)]
    for (i, j), cs in stats.items():
        scount[i][j] = cs.cell.count

    # ---- D1: comparacao global vs referencia -------------------------------
    banner("D1 — DESVIO GLOBAL: sugerido vs referencia manual")
    flat, covered = [], []
    for i in range(n_map):
        for j in range(n_rpm):
            r = ref[i][j]
            if not r:
                continue
            p = (sug[i][j] - r) / r * 100.0
            flat.append(p)
            if scount[i][j] > 0:
                covered.append(p)

    def _stats(vals, label):
        a = [abs(v) for v in vals]
        w1 = sum(1 for v in a if v <= 1)
        w5 = sum(1 for v in a if v <= 5)
        print(f"  {label}: n={len(vals)}  media={sum(vals)/len(vals):+.2f}%  "
              f"|desvio|={sum(a)/len(a):.2f}%  max={max(a):.1f}%  "
              f"<=1%:{w1}({w1*100//len(vals)}%)  <=5%:{w5}({w5*100//len(vals)}%)")

    _stats(flat, "todas    ")
    _stats(covered, "com dados")

    # ---- D2: celulas confiaveis que foram diluidas -------------------------
    banner("D2 — FONTE DA VERDADE VIOLADA (celulas estaveis com muitas amostras)")
    print("  Celulas com >=500 amostras e stability>=0.5 cujo VALOR SUGERIDO")
    print("  se afasta >2% do ve_lambda medido. Pela sua regra, deveriam ~= medido.\n")
    print(f"  {'MAP':>5} {'RPM':>6} {'amostr':>7} {'stab':>5} "
          f"{'medido':>8} {'sugerido':>9} {'desvio':>8}")
    viol = []
    for (i, j), cs in stats.items():
        if cs.cell.count >= 500 and cs.stability_score >= 0.5:
            d = (sug[i][j] - cs.cell.ve_lambda_avg) / cs.cell.ve_lambda_avg * 100.0
            if abs(d) > 2.0:
                viol.append((abs(d), i, j, cs, d))
    for _, i, j, cs, d in sorted(viol, reverse=True)[:20]:
        print(f"  {mp[i]:>5} {rpm[j]:>6} {cs.cell.count:>7} "
              f"{cs.stability_score:>5.2f} {cs.cell.ve_lambda_avg:>8.0f} "
              f"{sug[i][j]:>9} {d:>+7.1f}%")
    print(f"\n  TOTAL violacoes: {len(viol)}")

    # ---- D3: linhas de MAP incoerentes -------------------------------------
    banner("D3 — LINHAS DE MAP INCOERENTES (vies sistematico por linha)")
    print("  Vies medio de cada linha vs referencia. Uma linha inteira")
    print("  deslocada = perfil de MAP incoerente.\n")
    print(f"  {'linha':>5} {'MAP kPa':>8} {'vies medio':>11} {'amostras':>9}  sinal")
    for i in range(n_map - 1, -1, -1):
        ds = [(sug[i][j] - ref[i][j]) / ref[i][j] * 100.0
              for j in range(n_rpm) if ref[i][j]]
        bias = sum(ds) / len(ds)
        ns = sum(scount[i])
        flag = "  <<< deslocada" if abs(bias) > 2.5 else ""
        print(f"  {i:>5} {mp[i]:>8} {bias:>+10.2f}% {ns:>9}{flag}")

    # ---- D4: bumps introduzidos pelo algoritmo -----------------------------
    banner("D4 — BUMPS INTRODUZIDOS (algoritmo deixou celula mais aspera)")
    print("  Celulas cuja aspereza no SUGERIDO supera tanto o mapa ATUAL")
    print("  quanto a REFERENCIA — descontinuidade criada pelo algoritmo.\n")
    print(f"  {'MAP':>5} {'RPM':>6} {'asp.atual':>10} {'asp.ref':>9} "
          f"{'asp.sug':>9} {'amostras':>9}")
    bumps = []
    for i in range(n_map):
        for j in range(n_rpm):
            rs = _roughness(sug, i, j, n_map, n_rpm)
            rc = _roughness(cur, i, j, n_map, n_rpm)
            rr = _roughness(ref, i, j, n_map, n_rpm)
            excess = rs - max(rc, rr)
            if excess > 4.0:
                bumps.append((excess, i, j, rc, rr, rs))
    for _, i, j, rc, rr, rs in sorted(bumps, reverse=True)[:15]:
        print(f"  {mp[i]:>5} {rpm[j]:>6} {rc:>9.1f}% {rr:>8.1f}% "
              f"{rs:>8.1f}% {scount[i][j]:>9}")
    print(f"\n  TOTAL bumps: {len(bumps)}")

    # ---- D5: colunas RPM coladas -------------------------------------------
    banner("D5 — COLUNAS RPM COLADAS (gap entre colunas adjacentes colapsou)")
    print("  Pares de colunas onde o gap no SUGERIDO ficou <50% do gap na")
    print("  REFERENCIA (>15 raw) — colunas que deveriam estar separadas.\n")
    print(f"  {'MAP':>5} {'RPM par':>14} {'gap atual':>10} {'gap ref':>9} {'gap sug':>9}")
    close = []
    for i in range(n_map):
        for j in range(n_rpm - 1):
            gs = abs(sug[i][j + 1] - sug[i][j])
            gr = abs(ref[i][j + 1] - ref[i][j])
            gc = abs(cur[i][j + 1] - cur[i][j])
            if gr > 15 and gs < 0.5 * gr:
                close.append((gr - gs, i, j, gc, gr, gs))
    for _, i, j, gc, gr, gs in sorted(close, reverse=True)[:20]:
        print(f"  {mp[i]:>5} {rpm[j]:>5}-{rpm[j+1]:<6} {gc:>9} {gr:>9} {gs:>9}")
    print(f"\n  TOTAL pares colados: {len(close)}")

    # ---- D6: regiao 400-1600 RPM acima de 100 kPa --------------------------
    banner("D6 — REGIAO 400-1600 RPM, ACIMA DE 100 kPa (atual / sug / ref)")
    cols = [j for j in range(n_rpm) if rpm[j] <= 1600]
    rows = [i for i in range(n_map) if mp[i] > 100]
    for i in reversed(rows):
        seg = lambda M: " ".join(f"{M[i][j]:>4}" for j in cols)
        n = " ".join(f"{scount[i][j]:>4}" for j in cols)
        print(f"  {mp[i]:>3}kPa | atual {seg(cur)} | sug {seg(sug)} "
              f"| ref {seg(ref)} | amostras {n}")
    print(f"\n  colunas RPM: {[rpm[j] for j in cols]}")


# ===========================================================================
# Main
# ===========================================================================
def main() -> None:
    cfg = TuningConfig()

    print(f"Mapa atual : {MAP_FILE}")
    rpm, mp, cur = parse_map(MAP_FILE)
    print(f"  {len(rpm)} RPM x {len(mp)} MAP")
    _, _, ref = parse_map(REF_FILE)
    print(f"Referencia : {REF_FILE}")

    rows: list[DatalogRow] = []
    offset = 0
    for path in LOG_FILES:
        model = parse_datalog(open(path, "rb").read(), os.path.basename(path),
                              f"sha1:{os.path.basename(path)}")
        lr = [to_row(r) for r in model.rows]
        for r in lr:
            r.timestamp_ms += offset
        offset += (lr[-1].timestamp_ms if lr else 0) + 1
        rows.extend(lr)
        print(f"  log {os.path.basename(path)[:40]:40} {len(lr):>7} linhas")
    print(f"Total: {len(rows)} linhas de datalog")

    tinput = TuningInput(current_map=cur, rpm_breakpoints=rpm,
                         map_breakpoints=mp, datalog_rows=rows, config=cfg)

    # --- engine oficial (referencia de comportamento) -----------------------
    eng_out = VELambdaEngine().run(tinput)

    # --- pipeline do PoC (reusa etapas 1-5, algoritmo proprio na 6+) --------
    fr = Filter(cfg, rpm_breakpoints=rpm, map_breakpoints=mp).apply(rows)
    snapped, _ = Snap(rpm, mp).apply(fr.rows)
    ve = Formula().apply(snapped)
    agg = Aggregator(cfg).aggregate(ve)
    stats = Confidence(cfg).compute(agg)
    sug, V, has_data = solve_field(stats, cur, rpm, mp, cfg)

    scount = [[0] * len(rpm) for _ in range(len(mp))]
    for (i, j), cs in stats.items():
        scount[i][j] = cs.cell.count

    # --- comparacao: engine atual vs PoC novo (ambos vs referencia) ---------
    banner("COMPARACAO — engine atual vs PoC novo (vs referencia manual)")
    for label, M in (("engine atual", eng_out.suggested_map), ("PoC novo    ", sug)):
        mt, mx, ct, cx, w5 = vsref(M, ref, scount)
        print(f"  {label}: |desvio| todas={mt:.2f}% (max {mx:.1f}%)  "
              f"com dados={ct:.2f}% (max {cx:.1f}%)  <=5%={w5}%")
    changed = sum(1 for i in range(len(mp)) for j in range(len(rpm))
                  if sug[i][j] != eng_out.suggested_map[i][j])
    print(f"  Celulas alteradas vs engine atual : {changed}/{len(mp)*len(rpm)}")
    print(f"  Celulas com dados (ancoras)       : {len(has_data)}")

    diagnose(sug, ref, cur, stats, rpm, mp)

    banner("FIM — algoritmo editavel em solve_field()")


if __name__ == "__main__":
    main()
