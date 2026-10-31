from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'review-v01'
OUT.mkdir(exist_ok=True)
B, INK, MUTED, LINE = '#4f6bff', '#192435', '#6c7890', '#dce3f2'

def txt(im, x, y, s, size=26, color=INK):
    ImageDraw.Draw(im).text((x, y), s, font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', size), fill=color)

def rect(im, bounds, fill='white', outline=LINE, radius=18):
    ImageDraw.Draw(im).rounded_rectangle(bounds, radius, fill=fill, outline=outline, width=3)

def base(n, title, note, timing):
    im = Image.new('RGB', (1920, 1080), '#f7f9ff')
    txt(im, 90, 45, 'ODYSSEY / INTERFACE DESIGN', 22, B)
    txt(im, 90, 100, title, 46)
    txt(im, 90, 177, note, 25, MUTED)
    txt(im, 90, 985, f'S{n:02} · {timing} · 概念界面静态审阅，非开发截图；注释不进入成片', 23, MUTED)
    return im

def node(im, x, y, label, active=False, w=260):
    rect(im, (x, y, x+w, y+115), '#eef1ff' if active else 'white', B if active else LINE)
    txt(im, x+24, y+38, label, 25, B if active else INK)

def workflow(im, expanded):
    rect(im, (100, 280, 1820, 900))
    txt(im, 130, 305, 'Workflow', 27, B)
    if expanded:
        txt(im, 130, 363, 'Workflow  /  Review group  /  Check metadata', 25)
        ImageDraw.Draw(im).line((125, 420, 1795, 420), fill=LINE, width=2)
        xs, y = [160, 500, 840], 575
    else:
        xs, y = [310, 830, 1350], 560
    d = ImageDraw.Draw(im)
    for a, b in zip(xs, xs[1:]):
        d.line((a+260, y+58, b, y+58), fill=B, width=4)
        d.polygon([(b, y+58), (b-14, y+49), (b-14, y+67)], fill=B)
    for x, label in zip(xs, ['Collect documents', 'Check metadata', 'Review changes']):
        node(im, x, y, label, expanded and x == xs[1])
    if expanded:
        rect(im, (1200, 450, 1785, 860), '#f9faff')
        txt(im, 1230, 475, 'NODE SETTINGS', 22, B)
        txt(im, 1230, 525, 'Check metadata', 32)
        for yy, label, value in [(595, 'Node type', 'Task'), (695, 'Input', 'Selected documents')]:
            txt(im, 1230, yy, label, 21, MUTED)
            rect(im, (1230, yy+37, 1750, yy+88))
            txt(im, 1245, yy+44, value, 23)
        txt(im, 170, 790, 'SELECTED NODE', 23, B)

def graph(im, bounds, focus=False):
    x, y, w, h = bounds
    pts = [(x+w*.5,y+h*.48),(x+w*.2,y+h*.18),(x+w*.83,y+h*.22),(x+w*.23,y+h*.81),(x+w*.8,y+h*.82)]
    d = ImageDraw.Draw(im)
    for p in pts[1:]: d.line((pts[0],p), fill=B if focus else '#a9b6e6', width=3)
    labels = ['Metadata', 'Playbook', 'Relationships', 'Review policy', 'Source records']
    for i, ((px,py), label) in enumerate(zip(pts,labels)):
        r = 23 if i == 0 else 15
        d.ellipse((px-r,py-r,px+r,py+r), fill=B if i == 0 else '#dce3ff', outline=B)
        txt(im, px-65, py+32, label, 19, B if i == 0 else MUTED)

def knowledge(im, expanded=False, focus=False):
    rect(im, (100, 280, 1820, 900))
    txt(im, 130, 306, 'Knowledge Space', 27, B)
    if not expanded:
        graph(im, (430, 390, 1050, 390))
        return
    rect(im, (125, 385, 565, 865), '#f9faff')
    txt(im, 150, 410, 'DOCUMENTS', 22, B)
    txt(im, 150, 464, 'Document Curator Playbook', 24)
    for yy, label, active in [(530,'metadata-guidelines.md',True),(620,'relationship-guidelines.md',False),(710,'review-and-change-policy.md',False)]:
        if active: rect(im, (142,yy-8,545,yy+55), '#eef1ff', B, 10)
        txt(im, 155, yy+8, label, 21, B if active else MUTED)
    rect(im, (590, 385, 1220, 865))
    txt(im, 620, 411, 'DOCUMENT CONTENT', 22, B)
    txt(im, 620, 475, 'metadata-guidelines.md', 30)
    txt(im, 620, 542, 'Metadata guidelines', 27)
    txt(im, 620, 600, 'Each document includes:', 23, MUTED)
    for yy, label in [(650,'• Title and owner'),(695,'• Status and review date'),(740,'• Links to source evidence')]: txt(im, 630, yy, label, 23)
    txt(im, 620, 820, 'Illustrative document content', 18, MUTED)
    rect(im, (1245, 385, 1795, 865), '#f9faff', B if focus else LINE)
    txt(im, 1270, 411, 'KNOWLEDGE CONTEXT', 22, B)
    graph(im, (1290, 495, 430, 245), focus)
    if focus: txt(im, 1280, 819, 'Same selected document', 22, B)

frames=[]
im=base(1,'Similar questions, across the interface','先建立两个模块的关联；不同时塞入完整界面', '0–5.56s')
for x, name, sub in [(200,'Workflow','Steps · Levels · Settings'),(1010,'Knowledge Space','Documents · Content · Context')]:
    rect(im,(x,360,x+710,830));txt(im,x+40,405,name,40,B);txt(im,x+40,485,sub,25,MUTED)
node(im,280,610,'Node');node(im,590,610,'Settings',True)
graph(im,(1100,550,480,170));frames.append(im)
im=base(2,'More than a Canvas','先看步骤结构，尚未展开编辑上下文', '5.56–12.16s');workflow(im,False);frames.append(im)
im=base(3,'Know what you are editing','顶部层级 + 中央选中节点 + 右侧同名设置；动态版依次强调', '12.16–21.36s');workflow(im,True);frames.append(im)
im=base(4,'More than a graph','沿用相同界面外框，从 Workflow 平滑切入 Knowledge Space', '21.36–28.16s');knowledge(im);frames.append(im)
im=base(5,'Manage documents. Read their content.','列表与阅读页展开；相同文档贯穿三栏', '28.16–36.84s');knowledge(im,True);frames.append(im)
im=base(6,'One document, in context','保持文档选中状态，将视觉重点交给右侧知识关系', '36.84–约40s');knowledge(im,True,True);frames.append(im)

sheet=Image.new('RGB',(1920,1740),'#e5eaf3')
for i, im in enumerate(frames):
    im.save(OUT/f'S{i+1:02}.png')
    sheet.paste(im.resize((960,540),Image.Resampling.LANCZOS),((i%2)*960,(i//2)*580))
sheet.save(OUT/'FIG-007-008_分镜总览_v01.png')
print('Generated 6 storyboard frames and contact sheet.')
