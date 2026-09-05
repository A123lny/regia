import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import agent_autonomy as agent


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(agent, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(agent, "AUTONOMY_LEVELS_FILE", str(test_data_dir / "agent_autonomy_levels.json"))
    monkeypatch.setattr(agent, "DECISIONS_FILE", str(test_data_dir / "agent_decisions.json"))
    monkeypatch.setattr(agent, "PRESSURE_FILE", str(test_data_dir / "agent_commercial_pressure.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_all_progressive_categories_start_at_l1():
    levels = agent.list_autonomy_levels()
    for cat in agent.PROGRESSIVE_CATEGORIES:
        assert levels[cat] == "L1"


def test_never_autonomous_categories_are_always_manual():
    for cat in agent.NEVER_AUTONOMOUS_CATEGORIES:
        assert agent.get_autonomy_level(cat) == "manuale"
        assert agent.can_execute_autonomously(cat) is False


def test_cannot_set_level_for_never_autonomous_category():
    with pytest.raises(PermissionError):
        agent.set_autonomy_level("lancio_promozioni", "L3")


def test_can_execute_autonomously_only_at_l2_or_l3():
    agent.set_autonomy_level("promemoria_voucher", "L1")
    assert agent.can_execute_autonomously("promemoria_voucher") is False
    agent.set_autonomy_level("promemoria_voucher", "L2")
    assert agent.can_execute_autonomously("promemoria_voucher") is True


def test_undo_window_required_only_at_l2():
    agent.set_autonomy_level("report", "L2")
    assert agent.requires_undo_window("report") is True
    agent.set_autonomy_level("report", "L3")
    assert agent.requires_undo_window("report") is False


def test_promotion_suggested_after_enough_approved_decisions():
    for _ in range(9):
        agent.record_decision("richiami_officina", approved_without_changes=True)
    agent.record_decision("richiami_officina", approved_without_changes=False)

    suggestion = agent.get_promotion_suggestion("richiami_officina")
    assert suggestion["suggestion"] == "promuovi"
    assert suggestion["to_level"] == "L2"

    # La decisione resta manuale: il livello non cambia da solo
    assert agent.get_autonomy_level("richiami_officina") == "L1"


def test_no_suggestion_with_too_few_decisions():
    agent.record_decision("report", approved_without_changes=True)
    suggestion = agent.get_promotion_suggestion("report")
    assert suggestion["suggestion"] is None


def test_regression_suggested_when_corrections_increase():
    agent.set_autonomy_level("promemoria_voucher", "L2")
    for _ in range(8):
        agent.record_decision("promemoria_voucher", approved_without_changes=False)
    for _ in range(2):
        agent.record_decision("promemoria_voucher", approved_without_changes=True)

    suggestion = agent.get_promotion_suggestion("promemoria_voucher")
    assert suggestion["suggestion"] == "retrocedi"
    assert suggestion["to_level"] == "L1"


def test_apply_level_change_is_explicit():
    result = agent.apply_level_change("report", "L2")
    assert result["level"] == "L2"
    assert agent.get_autonomy_level("report") == "L2"


def test_commercial_pressure_limit_per_person_across_brands():
    contact = "mario@example.com"
    assert agent.can_send_commercial_message(contact) is True
    agent.record_commercial_message(contact)
    agent.record_commercial_message(contact)
    assert agent.can_send_commercial_message(contact) is False
    assert agent.get_month_to_date_commercial_count(contact) == 2


def test_never_autonomous_promotion_suggestion_is_none():
    for _ in range(20):
        agent.record_decision("lancio_promozioni", approved_without_changes=True)
    suggestion = agent.get_promotion_suggestion("lancio_promozioni")
    assert suggestion["suggestion"] is None
