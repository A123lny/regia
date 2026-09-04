import sys
import os
import io
from PIL import Image

# Ensure src/ is importable when running tests from project root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SRC = os.path.join(ROOT, 'src')
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from services.media_adapter import generate_placeholder


def test_generate_placeholder_returns_image():
    img = generate_placeholder(prompt="Test immagine", brand="Lenny", size=(200, 150))
    # Should be a PIL Image
    assert isinstance(img, Image.Image)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    data = buf.read()
    assert len(data) > 0
