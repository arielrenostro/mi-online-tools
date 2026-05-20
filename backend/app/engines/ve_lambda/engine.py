from __future__ import annotations
from dataclasses import asdict
from typing import Any

from app.core.contracts.tuning_input import TuningInput, TuningConfig
from app.core.contracts.tuning_output import TuningOutput, FilterStats, CellExtrapolation
from app.core.interfaces.tuning_engine import TuningEngine, MapType
from app.engines.ve_lambda.config import default_config, config_from_dict
from app.engines.ve_lambda.schema import CONFIG_SCHEMA
from app.engines.ve_lambda.pipeline.filter import Filter
from app.engines.ve_lambda.pipeline.snap import Snap
from app.engines.ve_lambda.pipeline.formula import Formula
from app.engines.ve_lambda.pipeline.aggregator import Aggregator
from app.engines.ve_lambda.pipeline.confidence import Confidence
from app.engines.ve_lambda.pipeline.cf_calculator import CFCalculator
from app.engines.ve_lambda.pipeline.interpolator import Interpolator
from app.engines.ve_lambda.pipeline.shape_propagation import ShapePropagation
from app.engines.ve_lambda.pipeline.applicator import Applicator
from app.engines.ve_lambda.pipeline.postprocessor import Postprocessor


class VELambdaEngine(TuningEngine):

    engine_id       = "ve_lambda"
    name            = "VE Lambda Tuning"
    target_map_type = MapType.FUEL_VE

    description = (
        "Motor de auto-tuning de eficiência volumétrica baseado na fórmula "
        "VE Lambda = (λ_medido + trim − λ_alvo) × VE_atual. "
        "Processa datalogs em closed loop, agrega amostras por célula, "
        "e interpola fatores de correção em 2D para preservar a topologia do mapa."
    )

    objective = (
        "Corrigir o mapa de VE para que o lambda medido convirja para o lambda "
        "alvo em todos os pontos de operação cobertos pelo log, sem introduzir "
        "spikes ou descontinuidades nas regiões sem dados."
    )

    def get_default_config(self) -> dict[str, Any]:
        return default_config()

    def get_config_schema(self) -> dict[str, Any]:
        return CONFIG_SCHEMA

    def run(self, input: TuningInput) -> TuningOutput:
        cfg = input.config

        # Apply time_range filtering if needed — rows already sliced by caller
        # Step 1: Filter
        filter_result = Filter(
            cfg,
            rpm_breakpoints=input.rpm_breakpoints,
            map_breakpoints=input.map_breakpoints,
        ).apply(input.datalog_rows)

        # Step 2: Snap
        snapped_rows, out_of_range = Snap(
            input.rpm_breakpoints, input.map_breakpoints
        ).apply(filter_result.rows)

        # Step 3: VE Lambda formula
        with_ve = Formula().apply(snapped_rows)

        # Step 4: Aggregate + outlier rejection
        agg_result = Aggregator(cfg).aggregate(with_ve)

        # Step 5: Confidence
        stats = Confidence(cfg).compute(agg_result)

        # Step 6: Correction factor
        cf_sparse = CFCalculator().compute(stats, input.current_map)

        # Step 7: 2D interpolation — mark cells filled by interpolation
        n_map = len(input.map_breakpoints)
        n_rpm = len(input.rpm_breakpoints)
        cells_interp: list[CellExtrapolation] = [
            CellExtrapolation(row_i=ri, col_j=cj, rule="interpolation_2d")
            for ri in range(n_map)
            for cj in range(n_rpm)
            if (ri, cj) not in cf_sparse
        ]

        cf_full = Interpolator(input.map_breakpoints, input.rpm_breakpoints).interpolate(cf_sparse)

        # Steps 8+9: Shape propagation — structural tendencies + cf_final composition
        cf_final = ShapePropagation(
            cfg, input.map_breakpoints, input.rpm_breakpoints
        ).compose(cf_full, cf_sparse, stats)

        # Step 10+11: Apply + limits
        applied = Applicator(cfg).apply(cf_final, input.current_map, stats)

        # Assemble FilterStats
        passed_count = len(snapped_rows)
        filter_stats = FilterStats(
            total_rows             = filter_result.total_rows,
            passed                 = passed_count,
            discarded_clt          = filter_result.discarded_clt,
            discarded_open_loop    = filter_result.discarded_open_loop,
            discarded_skip_cl      = filter_result.discarded_skip_cl,
            discarded_skip_rpm_bkt = filter_result.discarded_skip_rpm_bkt,
            discarded_skip_map_bkt = filter_result.discarded_skip_map_bkt,
            discarded_delta_rpm    = filter_result.discarded_delta_rpm,
            discarded_delta_map    = filter_result.discarded_delta_map,
            discarded_delta_lambda = filter_result.discarded_delta_lambda,
            discarded_max_lambda   = filter_result.discarded_max_lambda,
            discarded_delta_pedal  = filter_result.discarded_delta_pedal,
            discarded_out_of_range = out_of_range,
            discarded_outlier      = agg_result.outlier_count,
        )

        # Step 12: Post-processing
        return Postprocessor(cfg, input.map_breakpoints, input.rpm_breakpoints).run(
            applied, filter_stats, cells_interp
        )
