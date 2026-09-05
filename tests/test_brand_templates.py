import sys
import os
import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services import brand_templates


def test_list_templates_all():
    templates = brand_templates.list_templates()
    assert len(templates) == 8


def test_list_templates_filtered_by_brand():
    lenny_templates = brand_templates.list_templates(brand="Lenny")
    assert len(lenny_templates) == 4
    assert all(t["brand"] == "Lenny" for t in lenny_templates)


def test_get_template_unknown_returns_none():
    assert brand_templates.get_template("non_esiste") is None


def test_get_template_known():
    template = brand_templates.get_template("lenny_ristorante_settimana")
    assert template["label"] == "Ristorante della settimana"
    assert "nome_ristorante" in template["fields"]


def test_validate_fields_all_present():
    result = brand_templates.validate_fields(
        "lenny_ristorante_settimana",
        {"nome_ristorante": "Pizzeria Rossi", "piatto_in_evidenza": "Margherita", "invito_azione": "Ordina ora"},
    )
    assert result["valid"] is True
    assert result["missing_fields"] == []


def test_validate_fields_missing():
    result = brand_templates.validate_fields("lenny_ristorante_settimana", {"nome_ristorante": "Pizzeria Rossi"})
    assert result["valid"] is False
    assert "piatto_in_evidenza" in result["missing_fields"]


def test_validate_fields_unknown_template_raises():
    with pytest.raises(ValueError):
        brand_templates.validate_fields("non_esiste", {})


def test_render_preview_generates_image():
    values = {"nome_ristorante": "Pizzeria Rossi", "piatto_in_evidenza": "Margherita", "invito_azione": "Ordina ora"}
    img = brand_templates.render_preview("lenny_ristorante_settimana", values, output_format="social")
    assert img.size == brand_templates.FORMAT_SIZES["social"]


def test_render_preview_stampa_alta_risoluzione():
    values = {"nome_ristorante": "Pizzeria Rossi", "piatto_in_evidenza": "Margherita", "invito_azione": "Ordina ora"}
    img = brand_templates.render_preview("lenny_ristorante_settimana", values, output_format="stampa_a4")
    assert img.size == (2480, 3508)


def test_render_preview_missing_fields_raises():
    with pytest.raises(ValueError):
        brand_templates.render_preview("lenny_ristorante_settimana", {}, output_format="social")


def test_render_preview_invalid_format_raises():
    values = {"nome_ristorante": "X", "piatto_in_evidenza": "Y", "invito_azione": "Z"}
    with pytest.raises(ValueError):
        brand_templates.render_preview("lenny_ristorante_settimana", values, output_format="8k")
