from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvidenceSignal:
    key: str
    value: float | int | bool | str | None
    threshold: float | int | None = None
    detail: str | None = None
    weight: float = 1.0


@dataclass
class EvidenceBundle:
    signals: list[EvidenceSignal] = field(default_factory=list)

    def add(self, key: str, value: Any, threshold: float | int | None = None, detail: str | None = None, weight: float = 1.0) -> None:
        self.signals.append(
            EvidenceSignal(
                key=key,
                value=value,
                threshold=threshold,
                detail=detail,
                weight=weight,
            )
        )

    def summary(self) -> str:
        parts: list[str] = []
        for signal in self.signals:
            if signal.value is None:
                continue
            if signal.threshold is not None:
                parts.append(f"{signal.key}={signal.value} (threshold {signal.threshold})")
            else:
                parts.append(f"{signal.key}={signal.value}")
        return "; ".join(parts) if parts else "No direct evidence recorded."
