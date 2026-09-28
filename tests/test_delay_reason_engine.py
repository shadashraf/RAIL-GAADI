from backend.engines.delay_reason.engine import DelayReasonEngine


def test_late_incoming_departure_rule():
    engine = DelayReasonEngine()
    reason, level, score, evidence = engine.classify(
        previous_departure_delay_minutes=12,
        fresh_delay_minutes=4,
    )

    assert reason.value == "Late Incoming / Departure"
    assert level.value in {"LOW", "MEDIUM", "HIGH"}
    assert 0 <= score <= 1
    assert "previous_departure_delay_minutes" in evidence.summary()


def test_high_priority_rule_requires_evidence():
    engine = DelayReasonEngine()
    reason, _, _, _ = engine.classify(
        excess_halt_minutes=12,
        higher_priority_train_present=True,
        timing_overlap=True,
    )

    assert reason.value == "High Priority Train"
