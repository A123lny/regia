from PIL import Image, ImageDraw, ImageFont
import textwrap

def generate_placeholder(prompt: str, brand: str, size=(1024, 768)):
    """Genera un'immagine placeholder con testo: usata come stub per l'adapter.

    Sostituire con chiamata al servizio esterno (es. provider AI) mantenendo la stessa firma.
    """
    img = Image.new("RGB", size, color=(245, 245, 245))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except Exception:
        font = ImageFont.load_default()

    header = f"{brand} — Preview"
    body = f"{prompt}" if prompt else "(nessun brief fornito)"
    lines = textwrap.wrap(body, width=40)

    draw.text((20, 20), header, fill=(30, 30, 30), font=font)
    y = 70
    for line in lines:
        draw.text((20, y), line, fill=(60, 60, 60), font=font)
        y += 28

    # bordo semplice
    draw.rectangle([5, 5, size[0]-6, size[1]-6], outline=(200,200,200))
    return img
