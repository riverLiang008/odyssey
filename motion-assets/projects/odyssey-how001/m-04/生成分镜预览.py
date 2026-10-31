"""M-04 静态审阅稿，不是动画成片；依赖 Pillow 与 Windows 微软雅黑。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'review-v01'
OUT.mkdir(exist_ok=True)
BG, INK, BLUE, BORDER, MUTED = '#f8faff', '#17202a', '#4d72f2', '#d9e2f2', '#667085'
def text(d, x, y, value, size=18, color=INK):
    d.text((x, y), value, font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size), fill=color)
def box(d, r, active=False):
    d.rounded_rectangle(r, radius=10, fill='#eef3ff' if active else 'white',
                        outline=BLUE if active else BORDER, width=2)

def agent(im, stage):
    d = ImageDraw.Draw(im)
    box(d, (240, 160, 720, 440))
    text(d, 260, 177, 'AGENT ACTION · Research & synthesize', 18)
    labels = ['Model   GPT-4o', 'Goal   Analyze evidence for the brief',
              'Knowledge Spaces   Paper Research', 'Toolbox   Web Search · Read File']
    for i, label in enumerate(labels):
        y = 215+i*48
        active = stage == 1 and i < 2 or stage == 2 and i > 1 or stage == 3 and i == 2 or stage == 4 and i == 3
        box(d, (260, y, 700, y+38), active)
        text(d, 272, y+8, label, 17, BLUE if active else INK)
        if stage >= 2 and not active:
            region = im.crop((259, y-1, 702, y+40))
            im.paste(Image.blend(region, Image.new('RGB', region.size, BG), .65), (259, y-1))

titles = ['Agent Action: Four components', 'Model + Goal', 'Knowledge Space + ToolBox',
          'Knowledge Space: Knowing', 'ToolBox: Doing', 'Knowing vs Doing']
notes = ['0–1.2s · 建立四项结构', '1.2–3s · Model / Goal', '3–12.48s · 另两项与职责区分',
         '12.48–19.76s · 知识资源', '19.76–26.24s · 工具与行动', '26.24–32.13s · 同屏收束']
frames = []
for stage, (title, note) in enumerate(zip(titles, notes)):
    im = Image.new('RGB', (960, 540), BG)
    d = ImageDraw.Draw(im)
    text(d, 50, 30, f'ODYSSEY / HOW 001 · M-04 · {stage+1:02}', 16, BLUE)
    text(d, 50, 77, title, 29)
    if stage < 5:
        agent(im, stage)
        d = ImageDraw.Draw(im)
        if stage == 3:
            text(d, 180, 456, 'Knowledge  /  Instructions  /  Text resources', 23, BLUE)
        if stage == 4:
            text(d, 340, 456, 'Tools  /  Actions', 23, BLUE)
    else:
        # SK-06: 两块轻量展示框内保留 UI 资源区，结论放在框外下方。
        for x, title2, caption, label, accent in [
            (70, 'KNOWING', 'Knowledge / context', 'Knowledge Spaces', BLUE),
            (510, 'DOING', 'Tools / actions', 'Toolbox', '#ee8191')]:
            d.rounded_rectangle((x, 190, x+380, 390), radius=10,
                                fill='#f5f7fc', outline=BORDER, width=2)
            d.rounded_rectangle((x+18, 212, x+362, 295), radius=8,
                                fill='white', outline=accent, width=2)
            text(d, x+30, 224, label, 19)
            pills = [('Paper Research', 145)] if x == 70 else [('Web Search', 104), ('Read File', 85)]
            px = x+30
            for name, width in pills:
                d.rounded_rectangle((px, 257, px+width, 282), radius=12,
                                    fill='#eef3ff', outline=BORDER, width=1)
                text(d, px+9, 260, name, 13, BLUE)
                px += width+8
            text(d, px+3, 262, '+ Drop Knowledge Space' if x == 70 else '+ Drop Tool', 11, MUTED)
            text(d, x+35, 414, title2, 28, BLUE)
            text(d, x+35, 452, caption, 18, MUTED)
    text(ImageDraw.Draw(im), 50, 510, note+' · 静态审阅稿，非烧录字幕', 14, MUTED)
    im.resize((1920, 1080), Image.Resampling.LANCZOS).save(OUT/f'S{stage+1:02}.png')
    frames.append(im)
sheet = Image.new('RGB', (1920, 1620), BG)
for i, frame in enumerate(frames):
    sheet.paste(frame, ((i%2)*960, (i//2)*540))
sheet.save(OUT/'M-04_分镜总览_v01.png')
print('Generated six keyframes and contact sheet.')
