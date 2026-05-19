from __future__ import annotations
from dataclasses import dataclass
from app.core.contracts.tuning_input import DatalogRow, TuningConfig


@dataclass
class FilterResult:
    rows:                   list[DatalogRow]
    total_rows:             int
    discarded_clt:          int
    discarded_open_loop:    int
    discarded_skip_cl:      int
    discarded_skip_rpm_bkt: int
    discarded_skip_map_bkt: int
    discarded_delta_rpm:    int
    discarded_delta_map:    int
    discarded_delta_lambda: int
    discarded_max_lambda:   int
    discarded_delta_pedal:  int


class Filter:

    def __init__(
        self,
        config: TuningConfig,
        rpm_breakpoints: list[int] | None = None,
        map_breakpoints: list[int] | None = None,
    ) -> None:
        self._cfg  = config
        self._rpms = rpm_breakpoints
        self._maps = map_breakpoints

    def apply(self, rows: list[DatalogRow]) -> FilterResult:
        cfg = self._cfg
        passed: list[DatalogRow] = []

        d_clt = d_ol = d_skip_cl = d_skip_rpm = d_skip_map = 0
        d_drpm = d_dmap = d_dlambda = d_maxlambda = d_pedal = 0

        prev_rpm: float | None  = None
        prev_map: float | None  = None
        prev_pedal: float | None = None

        was_closed = False
        cl_count   = 0

        prev_rpm_bkt: int | None = None
        prev_map_bkt: int | None = None
        rpm_bkt_skip  = 0
        map_bkt_skip  = 0

        for row in rows:
            # CLT filter
            if row.clt < cfg.min_clt:
                d_clt += 1
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Lambda loop filter
            if cfg.lambda_loop_closed_only and row.lambda_loop != 1:
                d_ol += 1
                was_closed = False
                cl_count = 0
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Skip first N samples after entering closed loop
            if cfg.lambda_loop_closed_only:
                if row.lambda_loop == 1 and not was_closed:
                    was_closed = True
                    cl_count = 0
                if cl_count < cfg.skip_first_closed_loop:
                    cl_count += 1
                    d_skip_cl += 1
                    prev_rpm = row.rpm; prev_map = row.map_kpa
                    if row.pedal is not None:
                        prev_pedal = row.pedal
                    continue
                cl_count += 1

            # Delta RPM filter
            if prev_rpm is not None and abs(row.rpm - prev_rpm) > cfg.max_delta_rpm:
                d_drpm += 1
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Delta MAP filter
            if prev_map is not None and abs(row.map_kpa - prev_map) > cfg.max_delta_map:
                d_dmap += 1
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Max lambda filter
            if row.lambda1 > cfg.max_lambda:
                d_maxlambda += 1
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Delta lambda-target filter
            if abs(row.lambda1 - row.lambda_target) > cfg.max_delta_lambda_target:
                d_dlambda += 1
                prev_rpm = row.rpm; prev_map = row.map_kpa
                if row.pedal is not None:
                    prev_pedal = row.pedal
                continue

            # Delta pedal filter
            if cfg.max_delta_pedal is not None and row.pedal is not None and prev_pedal is not None:
                if abs(row.pedal - prev_pedal) > cfg.max_delta_pedal:
                    d_pedal += 1
                    prev_rpm = row.rpm; prev_map = row.map_kpa
                    prev_pedal = row.pedal
                    continue

            # Skip first N after RPM bucket change
            if self._rpms and cfg.skip_first_rpm_bucket > 0:
                curr_rpm_bkt = _nearest(row.rpm, self._rpms)
                if curr_rpm_bkt != prev_rpm_bkt:
                    prev_rpm_bkt = curr_rpm_bkt
                    rpm_bkt_skip = 0
                if rpm_bkt_skip < cfg.skip_first_rpm_bucket:
                    rpm_bkt_skip += 1
                    d_skip_rpm += 1
                    prev_rpm = row.rpm; prev_map = row.map_kpa
                    if row.pedal is not None:
                        prev_pedal = row.pedal
                    continue
                rpm_bkt_skip += 1

            # Skip first N after MAP bucket change
            if self._maps and cfg.skip_first_map_bucket > 0:
                curr_map_bkt = _nearest(row.map_kpa, self._maps)
                if curr_map_bkt != prev_map_bkt:
                    prev_map_bkt = curr_map_bkt
                    map_bkt_skip = 0
                if map_bkt_skip < cfg.skip_first_map_bucket:
                    map_bkt_skip += 1
                    d_skip_map += 1
                    prev_rpm = row.rpm; prev_map = row.map_kpa
                    if row.pedal is not None:
                        prev_pedal = row.pedal
                    continue
                map_bkt_skip += 1

            prev_rpm = row.rpm
            prev_map = row.map_kpa
            if row.pedal is not None:
                prev_pedal = row.pedal

            passed.append(row)

        return FilterResult(
            rows                   = passed,
            total_rows             = len(rows),
            discarded_clt          = d_clt,
            discarded_open_loop    = d_ol,
            discarded_skip_cl      = d_skip_cl,
            discarded_skip_rpm_bkt = d_skip_rpm,
            discarded_skip_map_bkt = d_skip_map,
            discarded_delta_rpm    = d_drpm,
            discarded_delta_map    = d_dmap,
            discarded_delta_lambda = d_dlambda,
            discarded_max_lambda   = d_maxlambda,
            discarded_delta_pedal  = d_pedal,
        )


def _nearest(value: float, breakpoints: list[int]) -> int:
    return min(breakpoints, key=lambda bp: abs(bp - value))
