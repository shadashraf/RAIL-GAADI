from __future__ import annotations

from enum import Enum


class DelayReasonType(str, Enum):
    LATE_INCOMING_DEPARTURE = "Late Incoming / Departure"
    HIGH_PRIORITY_TRAIN = "High Priority Train"
    PLATFORM_OCCUPIED = "Platform Occupied"
    CONGESTION_DELAY = "Congestion Delay"
    UNEXPECTED_HALT_DELAY = "Unexpected Halt Delay"
    INSUFFICIENT_EVIDENCE = "Insufficient Evidence"


class ConfidenceLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
