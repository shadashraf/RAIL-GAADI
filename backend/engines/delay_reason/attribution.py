from __future__ import annotations


def calculate_fresh_delay(current_delay_minutes: float | None, previous_delay_minutes: float | None) -> float | None:
    """Fresh delay is the increase over the prior station state, not the total cumulative delay."""
    if current_delay_minutes is None:
        return None
    if previous_delay_minutes is None:
        return current_delay_minutes
    return max(0.0, current_delay_minutes - previous_delay_minutes)
