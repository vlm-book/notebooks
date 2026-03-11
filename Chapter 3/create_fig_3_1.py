"""
iMessage-style visualization for VLM dataset samples.
User = right-aligned blue bubbles with white text.
Assistant = left-aligned light-gray bubbles with dark text.
Image inlined after the first user message (right-aligned).
Max 2 turns. Generates 10 images.
"""

import sys, os
from datasets import load_dataset
from PIL import Image, ImageDraw, ImageFont


# ── Fonts ────────────────────────────────────────────────────────────

def get_font(size):
    for name in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "DejaVuSans.ttf",
        "Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(name, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


FONT = get_font(20)
WIDTH = 600
PAD = 16
BUBBLE_PAD_H = 16
BUBBLE_PAD_V = 12
LINE_HEIGHT = 28
BUBBLE_MAX_W = int(WIDTH * 0.72)
BUBBLE_RADIUS = 18
GAP = 10
BG_COLOR = "#F2F2F7"

USER_BG = "#007AFF"
USER_TEXT = "#FFFFFF"
ASST_BG = "#E9E9EB"
ASST_TEXT = "#000000"


# ── Data helpers ─────────────────────────────────────────────────────

def extract_sample_image(sample):
    if "image" in sample and sample["image"] is not None:
        return sample["image"]
    if "images" in sample and sample["images"]:
        return sample["images"][0]
    raise KeyError("No image found in sample.")


def normalize_conversations(sample, max_turns=2):
    raw = sample.get("texts", [])
    normalized = []
    for msg in raw:
        if not isinstance(msg, dict):
            continue
        if "role" in msg and "content" in msg:
            normalized.append({"role": msg["role"], "content": msg["content"]})
            continue
        if "user" in msg:
            normalized.append({"role": "user", "content": str(msg["user"])})
        if "assistant" in msg:
            normalized.append({"role": "assistant", "content": str(msg["assistant"])})

    turns, current = [], []
    for msg in normalized:
        current.append(msg)
        if msg["role"] == "assistant":
            turns.append(current)
            current = []
    if current:
        turns.append(current)
    turns = turns[:max_turns]
    return [msg for turn in turns for msg in turn]


# ── Drawing helpers ──────────────────────────────────────────────────

def wrap_text(text, font, max_width, draw):
    lines = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        words = paragraph.split()
        cur = ""
        for w in words:
            test = f"{cur} {w}".strip()
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] > max_width:
                if cur:
                    lines.append(cur)
                cur = w
            else:
                cur = test
        if cur:
            lines.append(cur)
    return lines


def measure_bubble(lines):
    tmp = Image.new("RGB", (1, 1))
    d = ImageDraw.Draw(tmp)
    text_w = 0
    for line in lines:
        bbox = d.textbbox((0, 0), line, font=FONT)
        text_w = max(text_w, bbox[2] - bbox[0])
    text_h = len(lines) * LINE_HEIGHT
    bw = text_w + 2 * BUBBLE_PAD_H
    bh = text_h + 2 * BUBBLE_PAD_V
    return bw, bh


def round_image_corners(img, radius):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    result = img.copy().convert("RGBA")
    result.putalpha(mask)
    return result


# ── Main renderer ────────────────────────────────────────────────────

def render_imessage(sample_image, conversations, filename="imessage_style.png"):
    tmp = Image.new("RGB", (WIDTH, 100))
    tmp_draw = ImageDraw.Draw(tmp)
    inner_text_w = BUBBLE_MAX_W - 2 * BUBBLE_PAD_H

    items = []
    image_inserted = False

    for msg in conversations:
        role = msg["role"]
        text = msg["content"]

        text = text.strip()
        lines = wrap_text(text, FONT, inner_text_w, tmp_draw)
        bw, bh = measure_bubble(lines)
        items.append(("bubble", (role, lines, bw, bh), bh + GAP))

        # Insert image right after the first user message
        if role == "user" and not image_inserted:
            img_w, img_h = sample_image.size
            max_img_w = BUBBLE_MAX_W
            max_img_h = 320
            scale = min(max_img_w / img_w, max_img_h / img_h, 1.0)
            new_w = int(img_w * scale)
            new_h = int(img_h * scale)
            scaled = sample_image.resize((new_w, new_h), Image.LANCZOS)
            items.append(("image", scaled, new_h + 8))
            image_inserted = True

    total_h = PAD
    for _, _, h in items:
        total_h += h + GAP
    total_h += PAD

    canvas = Image.new("RGB", (WIDTH, total_h), BG_COLOR)
    draw = ImageDraw.Draw(canvas)
    y = PAD

    for item_type, data, h in items:
        if item_type == "image":
            scaled = data
            sw, sh = scaled.size
            ix = WIDTH - PAD - sw
            rounded = round_image_corners(scaled, BUBBLE_RADIUS)
            canvas.paste(rounded, (ix, y), rounded)
            y += sh + GAP + 4

        elif item_type == "bubble":
            role, lines, bw, bh = data
            is_user = role == "user"
            bg = USER_BG if is_user else ASST_BG
            text_color = USER_TEXT if is_user else ASST_TEXT
            bx = (WIDTH - PAD - bw) if is_user else PAD

            draw.rounded_rectangle(
                [bx, y, bx + bw, y + bh],
                radius=BUBBLE_RADIUS,
                fill=bg,
            )

            ty = y + BUBBLE_PAD_V
            for line in lines:
                draw.text((bx + BUBBLE_PAD_H, ty), line, fill=text_color, font=FONT)
                ty += LINE_HEIGHT
            y += bh + GAP

    canvas.save(filename)
    print(f"Saved {filename} ({WIDTH}x{total_h})")
    return canvas


# ── Generate 10 images ───────────────────────────────────────────────

dataset = load_dataset("HuggingFaceM4/FineVisionMax", split="train", streaming=True)

count = 0
for sample in dataset:
    if count >= 50:
        break
    try:
        sample_image = extract_sample_image(sample).convert("RGB")
        conversations = normalize_conversations(sample, max_turns=2)
    except (KeyError, ValueError):
        continue
    render_imessage(sample_image, conversations, filename=f"imessage_style_{count:02d}.png")
    count += 1

print(f"Done — saved {count} images.")
os._exit(0)