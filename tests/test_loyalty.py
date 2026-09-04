import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import loyalty


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(loyalty, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(loyalty, "COUNTERS_FILE", str(test_data_dir / "counters.json"))
    monkeypatch.setattr(loyalty, "VOUCHERS_FILE", str(test_data_dir / "vouchers.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_counter_created_and_incremented():
    result = loyalty.increment_counter("+37800001", "Stazione", threshold=3)
    assert result["counter"]["value"] == 1
    assert result["reached"] is False

    result = loyalty.increment_counter("+37800001", "Stazione", threshold=3)
    result = loyalty.increment_counter("+37800001", "Stazione", threshold=3)
    assert result["reached"] is True
    assert result["counter"]["value"] == 0  # azzerato dopo premio


def test_issue_voucher_creates_unique_code():
    v1 = loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "10% sconto")
    v2 = loyalty.issue_voucher("+37800002", "Stazione", "Lenny", "lavaggio", "10% sconto")
    assert v1["code"] != v2["code"]
    assert v1["state"] == "emesso"


def test_verify_voucher_valid():
    v = loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "Voucher test")
    result = loyalty.verify_voucher(v["code"])
    assert result["valid"] is True


def test_verify_voucher_not_found():
    result = loyalty.verify_voucher("CODICE-INESISTENTE")
    assert result["valid"] is False


def test_redeem_voucher_success_and_idempotent():
    v = loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "Voucher test")

    first = loyalty.redeem_voucher(v["code"])
    assert first["success"] is True
    assert first["voucher"]["state"] == "riscattato"

    # Seconda chiamata con lo stesso codice: idempotente, nessun doppio uso
    second = loyalty.redeem_voucher(v["code"])
    assert second["success"] is True
    assert "già riscattato" in second["reason"].lower()


def test_redeem_voucher_not_found():
    result = loyalty.redeem_voucher("NON-ESISTE")
    assert result["success"] is False


def test_verify_after_redeem_shows_invalid():
    v = loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "Voucher test")
    loyalty.redeem_voucher(v["code"])
    result = loyalty.verify_voucher(v["code"])
    assert result["valid"] is False
    assert "già utilizzato" in result["reason"].lower()


def test_list_vouchers_filters_by_brand():
    loyalty.issue_voucher("+37800001", "Stazione", "Lenny", "lavaggio", "V1")
    loyalty.issue_voucher("+37800002", "Lenny", "Stazione", "cibo", "V2")

    stazione_vouchers = loyalty.list_vouchers(brand="Stazione")
    assert len(stazione_vouchers) == 2  # appare come source o target in entrambi i casi

    lenny_only_source = [v for v in loyalty.list_vouchers() if v["source_brand"] == "Lenny"]
    assert len(lenny_only_source) == 1
