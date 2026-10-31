"""静态审阅稿，使用 Pillow 和本机字体；非动画成片。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'review-v01'
OUT.mkdir(exist_ok=True)
INK, BLUE, BG, BORDER, MUTED = '#17202a', '#4d72f2', '#f8faff', '#d9e2f2', '#667085'
FONT = 'C:/Windows/Fonts/msyh.ttc'

def txt(d, xy, value, size=18, fill=INK):
    d.text(xy, value, font=ImageFont.truetype(FONT, size), fill=fill)

def rect(d, r, active=False):
    d.rounded_rectangle(r, radius=10, fill='#eef3ff' if active else 'white',
                        outline=BLUE if active else BORDER, width=2)

def agent(d, active, goal):
    rect(d, (55, 175, 460, 425), active)
    txt(d, (75, 190), 'AGENT ACTION · Research & synthesize', 17)
    rows = [(225, 'Model   GPT-4o', False), (265, 'Goal   Analyze evidence for the brief', goal),
            (305, 'Knowledge Spaces   Paper Research', False),
            (355, 'Toolbox   Web Search · Read File', False)]
    for y, label, selected in rows:
        rect(d, (75, y, 440, y+34), selected)
        txt(d, (85, y+7), label, 15, BLUE if selected else INK)

def task(d, active, steps):
    rect(d, (505, 200, 905, 400), active)
    txt(d, (525, 215), 'TASK · Publish research brief', 18)
    txt(d, (525, 245), 'Predefined sequence', 15, MUTED)
    for i, label in enumerate(['Knowledge Retrieval', 'Extract Section', 'Write Variable']):
        y = 275+i*35
        rect(d, (525, y, 885, y+29), steps)
        txt(d, (536, y+4), f'{i+1}   {label}', 15, BLUE if steps else INK)

titles = ['Agent and Task: one comparison', 'Thinking Ownership', 'Agent Action: Model + Goal',
          'Agent: goal-bound freedom', 'Task: Predefined steps', 'Who makes the decisions?']
notes = ['0–3s · 建立 Agent / Task 对照', '3–7s · 提出决策权问题', '7–9.5s · 聚焦 Agent 配置',
         '9.5–12s · 突出目标约束', '12–16s · 预定义工具步骤', '16–20.5s · 完整对照收束']
frames = []
for i, (title, note) in enumerate(zip(titles, notes)):
    im = Image.new('RGB', (960, 540), BG)
    d = ImageDraw.Draw(im)
    txt(d, (50, 30), f'ODYSSEY / HOW 001 · M-03 · {i+1:02}', 16, BLUE)
    txt(d, (50, 75), title, 30)
    if i == 1:
        txt(d, (50, 125), 'Who makes the decisions?', 22, BLUE)
    agent(d, i in [2, 3], i == 3)
    task(d, i == 4, i == 4)
    if i in [2, 3]:
        overlay = Image.new('RGB', (410, 210), BG)
        region = im.crop((500, 195, 910, 405))
        im.paste(Image.blend(region, overlay, 0.68), (500, 195))
    if i == 4:
        overlay = Image.new('RGB', (415, 260), BG)
        region = im.crop((50, 170, 465, 430))
        im.paste(Image.blend(region, overlay, 0.68), (50, 170))
    d = ImageDraw.Draw(im)
    if i == 5:
        txt(d, (75, 445), 'Goal-bound choices', 20, BLUE)
        txt(d, (525, 445), 'Operation defined in advance', 20, BLUE)
    txt(d, (50, 505), note + ' · 静态审阅稿，非烧录字幕', 15, MUTED)
    full = im.resize((1920, 1080), Image.Resampling.LANCZOS)
    full.save(OUT / f'S{i+1:02}.png')
    frames.append(im)
sheet = Image.new('RGB', (1920, 1620), BG)
for i, im in enumerate(frames):
    sheet.paste(im, ((i%2)*960, (i//2)*540))
sheet.save(OUT / 'M-03_分镜总览_v01.png')
print('Generated six static keyframes and contact sheet.')
