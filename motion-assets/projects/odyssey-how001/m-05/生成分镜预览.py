"""M-05 静态概念分镜，非产品运行截图。"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent
OUT = ROOT/'review-v01'
OUT.mkdir(exist_ok=True)
BG, INK, BLUE, BORDER, MUTED = '#f8faff', '#17202a', '#4d72f2', '#d9e2f2', '#667085'
NAMES = ['metadata-guidelines.md', 'relationship-guidelines.md', 'review-and-change-policy.md']
def text(d,x,y,s,size=18,color=INK):
    d.text((x,y),s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
def box(d,r,active=False):
    d.rounded_rectangle(r,10,fill='#eef3ff' if active else 'white',outline=BLUE if active else BORDER,width=2)
def arrow(d,a,b):
    d.line([a,b],fill=BLUE,width=2)
    angle=math.atan2(b[1]-a[1],b[0]-a[0])
    for delta in [-.5,.5]:
        p=(b[0]-10*math.cos(angle+delta),b[1]-10*math.sin(angle+delta))
        d.line([b,p],fill=BLUE,width=2)
def files(d):
    text(d,45,160,'FOLDER STORAGE',14,MUTED)
    # 文件夹的上沿标签与容器轮廓，直接表达存储归属。
    d.polygon([(40,219),(40,195),(58,185),(146,185),(163,207),
               (305,207),(320,222),(320,435),(40,435)],
              fill='#eef3ff',outline=BLUE,width=2)
    d.rounded_rectangle((40,219,320,440),10,fill='white',outline=BORDER,width=2)
    d.rounded_rectangle((52,234,308,291),7,fill='#eef3ff')
    d.polygon([(62,255),(72,255),(67,262)],fill=BLUE)
    d.line([(81,260),(81,248),(91,248),(96,253),(106,253),(106,268),(81,268),(81,260)],fill=BLUE,width=2)
    text(d,115,240,'Document Curator',15)
    text(d,115,262,'Playbook',15)
    d.line([(68,299),(68,410)],fill=BORDER,width=2)
    for i,name in enumerate(NAMES):
        y=313+i*45
        d.line([(68,y+11),(83,y+11)],fill=BORDER,width=2)
        # 折角文档图标与树状缩进，无执行箭头。
        d.polygon([(87,y),(98,y),(104,y+6),(104,y+23),(87,y+23)],fill='white',outline=BLUE,width=1)
        d.line([(98,y),(98,y+6),(104,y+6)],fill=BLUE,width=1)
        d.line([(91,y+12),(100,y+12)],fill=BORDER,width=1)
        d.line([(91,y+16),(100,y+16)],fill=BORDER,width=1)
        text(d,112,y+2,name,12)
def graph(d,stage):
    if stage==4:
        d.rounded_rectangle((354,186,936,326),12,fill='#eef3ff',outline=BORDER,width=2)
        text(d,370,192,'GROUP · Review context (example)',13,BLUE)
    points=[(380,235),(685,235),(535,365)]
    # 连接表示概念关系，非截图逐边复制，不表示执行顺序。
    arrow(d,(625,265),(685,265))
    arrow(d,(750,305),(735,365))
    arrow(d,(550,365),(510,305))
    if stage==5:
        arrow(d,(685,284),(625,284))
        arrow(d,(710,365),(725,305))
        arrow(d,(485,305),(525,365))
    for i,(x,y) in enumerate(points):
        box(d,(x,y,x+245,y+70),stage==3 and i==0)
        text(d,x+12,y+12,NAMES[i],13)
        text(d,x+12,y+39,'Document',13,MUTED)
        if stage==4:
            text(d,x+12,y+54,['#Metadata Quality','#Graph Relationships','#Change Governance'][i],11,BLUE)
    if stage==3:
        text(d,380,150,'NODE = Document',18,BLUE)
        text(d,650,205,'EDGE = Relationship',16,BLUE)

titles=['Storage and organization','Documents stay in folders','Relationships form a directed graph',
        'A document. A relationship.','Groups and Tags','A connected knowledge network']
notes=['0–7.18s · 区分两个维度','7.18–11.08s · 保留文件存储','11.08–17.36s · 建立有向关系',
       '17.36–25.12s · 解释节点与边','25.12–32.52s · 分组与标签','32.52–44.43s · 关系网络收束']
frames=[]
for stage,(title,note) in enumerate(zip(titles,notes)):
    im=Image.new('RGB',(960,540),BG);d=ImageDraw.Draw(im)
    text(d,45,27,f'ODYSSEY / HOW 001 · M-05 · {stage+1:02}',16,BLUE)
    text(d,45,72,title,28)
    files(d)
    if stage==0:
        box(d,(385,205,900,420))
        text(d,420,235,'STORED IN',20,BLUE)
        text(d,420,278,'Folders',22)
        text(d,420,330,'ORGANIZED AS · Relationships',20,BLUE)
    elif stage==1:
        text(d,400,245,'Same documents. Same storage.',24,BLUE)
        text(d,400,305,'A separate view of their relationships.',20,MUTED)
    else:
        graph(d,stage)
    text(d,45,473,'Concept illustration · Same documents in both views',15,MUTED)
    text(d,45,511,note+' · 静态审阅稿，非烧录字幕',14,MUTED)
    im.resize((1920,1080),Image.Resampling.LANCZOS).save(OUT/f'S{stage+1:02}.png')
    frames.append(im)
sheet=Image.new('RGB',(1920,1620),BG)
for i,im in enumerate(frames): sheet.paste(im,((i%2)*960,(i//2)*540))
sheet.save(OUT/'M-05_分镜总览_v01.png')
print('Generated six keyframes and contact sheet.')
