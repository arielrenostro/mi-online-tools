from __future__ import annotations


CONFIG_SCHEMA: dict = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "title": "VE Lambda Tuning Config",
    "type": "object",
    "properties": {
        "min_clt":                  {"type": "number", "default": 80.0,    "description": "Temperatura mínima do motor (°C)"},
        "lambda_loop_closed_only":  {"type": "boolean","default": True,    "description": "Usar apenas amostras em closed loop"},
        "skip_first_closed_loop":   {"type": "integer","default": 10,      "description": "Ignorar N amostras após entrar em closed loop"},
        "skip_first_rpm_bucket":    {"type": "integer","default": 0,       "description": "Ignorar N amostras após mudar de bucket de RPM"},
        "skip_first_map_bucket":    {"type": "integer","default": 0,       "description": "Ignorar N amostras após mudar de bucket de MAP"},
        "max_delta_rpm":            {"type": "number", "default": 99999.0, "description": "Descarte por variação brusca de RPM"},
        "max_delta_map":            {"type": "number", "default": 99999.0, "description": "Descarte por variação brusca de MAP (kPa)"},
        "max_delta_lambda_target":  {"type": "number", "default": 0.2,     "description": "Descarte se |lambda - target| > valor (λ)"},
        "max_lambda":               {"type": "number", "default": 1.09,    "description": "Descarte se lambda medido > valor"},
        "max_delta_pedal":          {"type": ["number","null"], "default": None, "description": "Descarte por variação de pedal (%; null = desabilitado)"},
        "outlier_sigma":            {"type": "number", "default": 2.0,     "description": "Rejeição intra-célula: N × desvio padrão"},
        "cv_threshold":             {"type": "number", "default": 0.15,    "description": "CV máximo antes de penalizar estabilidade"},
        "weight_sample_base":       {"type": "integer","default": 40,      "description": "K na fórmula count_score = n / (n + K)"},
        "max_correction_pct":       {"type": "number", "default": 15.0,    "description": "Correção máxima por rodada (%)"},
        "convergence_threshold":    {"type": "number", "default": 5.0,     "description": "Residual abaixo do qual a célula é 'convergida' (%)"},
        "rpm400_rule_enabled":      {"type": "boolean","default": True,    "description": "Aplicar regra de RPM 400"},
        "rpm400_discount":          {"type": "number", "default": 0.045,   "description": "Desconto aplicado à coluna de 400 RPM"},
        "low_map_rule_enabled":     {"type": "boolean","default": True,    "description": "Aplicar regra de MAP baixo sem dados"},
        "low_map_threshold":        {"type": "integer","default": 20,      "description": "Limite de MAP (kPa) para a regra de MAP baixo"},
        "low_map_discount":         {"type": "number", "default": 0.025,   "description": "Desconto aplicado à linha de MAP baixo"},
        "max_adjacent_gradient_pct":{"type": "number", "default": 20.0,   "description": "Gradiente máximo entre células vizinhas para warning (%)"},
    },
    "additionalProperties": False,
}
