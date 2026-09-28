from __future__ import annotations

from backend.engines.delay_reason.types import ConfidenceLevel


def score_confidence(evidence_count: int, rule_strength: float = 1.0) -> tuple[ConfidenceLevel, float]:
    """Simple V1 confidence scoring based on evidence count and rule strength."""
    base = min(0.95, 0.35 + (evidence_count * 0.12) + (rule_strength * 0.15))
    base = max(0.15, min(base, 0.92))

    if base >= 0.75:
        level = ConfidenceLevel.HIGH
    elif base >= 0.45:
        level = ConfidenceLevel.MEDIUM
    else:
        level = ConfidenceLevel.LOW

    return level, round(base, 3)
