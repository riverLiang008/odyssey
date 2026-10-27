"""生成审阅用静态关键画面；不代表动画或音画同步验收。仓库根目录运行。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'review-v01'
OUT.mkdir(exist_ok=True)
W, H = 1920, 1080
BG, WHITE, INK = '#F7F9FE', '#FFFFFF', '#192338'
BLUE, PALE, BORDER, MUTED = '#4F6BFF', '#EBF0FF', '#CDD6E9', '#697991'
FONT = 'C:/Windows/Fonts/msyh.ttc'
BOLD = 'C:/Windows/Fonts/msyhbd.ttc'

def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)

def text(d, xy, value, size=30, fill=INK, bold=False, anchor=None):
    d.text(xy, value, font=font(size, bold), fill=fill, anchor=anchor)

def box(d, rect, fill=WHITE, outline=BORDER, width=3, radius=20):
    d.rounded_rectangle(rect, radius, fill=fill, outline=outline, width=width)

def arrow(d, start, end, color=INK, width=5):
    import math
    d.line([start, end], fill=color, width=width)
    a = math.atan2(end[1]-start[1], end[0]-start[0])
    p = [(end[0]-19*math.cos(a-s), end[1]-19*math.sin(a-s)) for s in [-0.5, 0.5]]
    d.line([p[0], end, p[1]], fill=color, width=width)

def base(n, title, subtitle):
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    text(d, (100, 65), f'ODYSSEY / HOW 001                                      M-01 · {n:02}', 25, BLUE, True)
    text(d, (100, 130), title, 55, bold=True)
    text(d, (103, 218), subtitle, 28, MUTED)
    # 审阅标记放在底部字幕预留区内，成片不显示。
    d.line([(100, 922), (1820, 922)], fill=BORDER, width=2)
    text(d, (100, 956), '分镜审阅 v01 · 静态关键画面 · 底部 160px 预留后期字幕', 24, MUTED)
    return im, d

def modules(d, pattern=False, behavior=False):
    rects = [(150, 350, 485, 570), (615, 350, 1305, 570), (1435, 350, 1770, 570)]
    for r, label in zip(rects, ['Input Guardrail', 'Execution Module', 'Output Guardrail']):
        box(d, r, outline=BLUE if label == 'Execution Module' else BORDER)
        text(d, ((r[0]+r[2])/2, 395 if pattern else 455), label, 31, bold=True, anchor='mm')
    arrow(d, (510, 460), (590, 460))
    arrow(d, (1330, 460), (1410, 460))
    if pattern:
        text(d, (650, 430), 'PATTERN · Linear (example)', 23, BLUE)
        for i in range(3):
            x = 657 + i*207
            box(d, (x, 475, x+165, 540), fill=WHITE)
            text(d, (x+82, 507), f'Agent {i+1}', 25, anchor='mm')
            if i < 2:
                arrow(d, (x+172, 507), (x+199, 507), BLUE, 3)
    if behavior:
        for x in [318, 960, 1602]:
            for y in range(574, 685, 18):
                d.line([(x, y), (x, y+8)], fill=BLUE, width=3)
        box(d, (150, 695, 1770, 815), fill=PALE, outline=BLUE)
        text(d, (960, 754), 'Execution Behavior · applies across the system', 34, BLUE, True, 'mm')

frames = []
im, d = base(1, 'A simple two-dimensional layout', 'From the early sketch to a clear configuration structure')
sketch = next(ROOT.glob('*SK-01_v01.png'))
src = Image.open(sketch).convert('RGB')
src.thumbnail((1580, 600))
im.paste(src, ((W-src.width)//2, 300))
frames.append(im)

im, d = base(2, 'Execution Modules', 'The horizontal direction organizes the execution structure')
modules(d)
text(d, (960, 710), 'Module boundaries first. Internal structure comes next.', 30, MUTED, anchor='mm')
frames.append(im)

im, d = base(3, 'Inside a module: Pattern', 'A Pattern connects Agents in a certain structure')
modules(d, pattern=True)
text(d, (960, 735), 'Module-to-module order  /  Agent connections inside the module', 30, MUTED, anchor='mm')
frames.append(im)

im, d = base(4, 'Execution Behaviors', 'A cross-cutting dimension, not another execution step')
modules(d, pattern=True, behavior=True)
frames.append(im)

im, d = base(5, 'What moves the system forward?', 'Keep the distinction visible while the narration explains it')
for r in [(150, 350, 905, 810), (1015, 350, 1770, 810)]:
    box(d, r)
text(d, (527, 435), 'MODULE / PATTERN', 36, BLUE, True, 'mm')
text(d, (1392, 435), 'BEHAVIOR', 36, BLUE, True, 'mm')
text(d, (527, 555), 'Moves the system forward', 34, anchor='mm')
arrow(d, (330, 670), (725, 670), BLUE)
text(d, (1392, 545), 'Does not move it forward', 32, anchor='mm')
text(d, (1392, 595), 'on its own', 32, anchor='mm')
text(d, (1392, 705), 'Cross-cutting · no execution arrow', 25, MUTED, anchor='mm')
frames.append(im)

im, d = base(6, 'From concept to configuration', 'Optional silent handoff · the filled Agent 1 is configured')
ui = next(ROOT.glob('*UI-05_v01.png'))
src = Image.open(ui).convert('RGB')
# 裁切真实截图的系统配置区域；保留已配置 Agent 1 与空槽，不重绘事实。
sw, sh = src.size
src = src.crop((round(sw*.32), round(sh*.185), round(sw*.99), round(sh*.965)))
src.thumbnail((1260, 590))
px, py = 120, 300
im.paste(src, (px, py))
box(d, (120, 300, px+src.width, py+src.height), fill=None)
text(d, (1450, 435), 'Agent 1', 37, BLUE, True)
text(d, (1450, 505), 'Filled = configured', 25)
text(d, (1450, 565), 'Dashed = empty slot', 25, MUTED)
text(d, (1450, 660), 'Not an execution result', 23, MUTED)
frames.append(im)

sheet = Image.new('RGB', (1920, 1764), '#E5EAF5')
captions = ['01 / 0–10s · 草图与二维布局', '02 / 10–15s · 横向模块', '03 / 15–21s · 模块内部 Pattern', '04 / 21–27s · 纵向行为', '05 / 27–40s · 关键区别', '06 / 可选 40.4–44s · 配置收尾']
sd = ImageDraw.Draw(sheet)
for i, (im, caption) in enumerate(zip(frames, captions)):
    im.save(OUT / f'S{i+1:02}.png')
    x, y = (i%2)*960, (i//2)*588
    sheet.paste(im.resize((960, 540), Image.Resampling.LANCZOS), (x, y))
    text(sd, (x+28, y+548), caption, 23, INK, True)
sheet.save(OUT / 'M-01_分镜总览_v01.png')
print(f'Generated {len(frames)} keyframes and contact sheet: {OUT}')
