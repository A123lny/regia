import sys
import os
import shutil
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import reviews


@pytest.fixture(autouse=True)
def isolate_data_dir(tmp_path, monkeypatch):
    test_data_dir = tmp_path / "data"
    monkeypatch.setattr(reviews, "DATA_DIR", str(test_data_dir))
    monkeypatch.setattr(reviews, "REVIEWS_FILE", str(test_data_dir / "reviews.json"))
    yield
    if test_data_dir.exists():
        shutil.rmtree(test_data_dir, ignore_errors=True)


def test_classify_positive():
    assert reviews.classify_review(5, "Ottimo servizio, tutto perfetto") == "positiva"


def test_classify_negative():
    assert reviews.classify_review(2, "Ho aspettato troppo, poco professionali") == "negativa"


def test_classify_severe_overrides_rating():
    # Anche con rating alto, una parola chiave grave prevale
    assert reviews.classify_review(5, "Mi sono sentito male dopo il pasto, sono finito in ospedale") == "grave"


def test_create_review_positive_has_draft():
    r = reviews.create_review(brand="Lenny", author_name="Mario", rating=5, text="Fantastico!")
    assert r["category"] == "positiva"
    assert r["draft_response"] is not None
    assert r["state"] == "bozza_pronta"


def test_create_review_severe_has_no_draft():
    r = reviews.create_review(
        brand="Stazione", author_name="Luca", rating=1,
        text="Ho avuto un'aggressione nel parcheggio"
    )
    assert r["category"] == "grave"
    assert r["draft_response"] is None
    assert r["state"] == "segnalata"


def test_approve_and_publish():
    r = reviews.create_review(brand="Lenny", author_name="Anna", rating=2, text="Servizio lento")
    published = reviews.approve_and_publish(r["id"], "Ci scusiamo, la contatteremo in privato.", "owner")
    assert published["state"] == "pubblicata"
    assert published["final_response"] == "Ci scusiamo, la contatteremo in privato."
    assert published["approved_by"] == "owner"


def test_list_reviews_filters_by_brand():
    reviews.create_review(brand="Lenny", author_name="A", rating=5, text="Bene")
    reviews.create_review(brand="Stazione", author_name="B", rating=4, text="Bene anche qui")
    lenny_reviews = reviews.list_reviews(brand="Lenny")
    assert len(lenny_reviews) == 1
    assert lenny_reviews[0]["brand"] == "Lenny"


def test_follow_up_request():
    r = reviews.create_review(brand="Lenny", author_name="C", rating=2, text="Non benissimo")
    updated = reviews.request_follow_up_review(r["id"])
    assert updated["follow_up_requested"] is True
