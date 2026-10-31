"""生成截图裁切与高亮静态审阅图；不修改原截图。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'review-v01'
OUT.mkdir(exist_ok=True)
BLUE='#4f6bff';BG='#f7f9ff';INK='#17202a';MUTED='#69758b'
def text(im,xy,s,size=28,color=INK):
    ImageDraw.Draw(im).text(xy,s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
def panel(im,file,crop,dest,focus=()):
    source=Image.open(ROOT/file).convert('RGB').crop(crop)
    if focus:
        dark=Image.new('RGB',source.size,'#26334d')
        faded=Image.blend(source,dark,.24)
        for box in focus:
            b=tuple(round(v) for v in box)
            faded.paste(source.crop(b),b[:2])
            ImageDraw.Draw(faded).rounded_rectangle(b,12,outline=BLUE,width=4)
        source=faded
    x,y,w,h=dest;source.thumbnail((w,h),Image.Resampling.LANCZOS)
    im.paste(source,(x+(w-source.width)//2,y+(h-source.height)//2))
def frame(num,title,subtitle):
    im=Image.new('RGB',(1920,1080),BG)
    text(im,(90,42),'ODYSSEY / KNOWLEDGE ACCESS',22,BLUE)
    text(im,(90,92),title,42)
    text(im,(90,155),subtitle,24,MUTED)
    text(im,(90,985),f'{num} · 静态分镜审阅 · 底部字幕安全区',22,MUTED)
    return im
frames=[]
im=frame('S01','How do we search for knowledge?','当前开发界面 · 建立文档与关系网络')
panel(im,'03.png',(360,360,2450,1305),(100,220,1720,690))
frames.append(im)
im=frame('S02','Retrieval helps us find useful information','强调工具入口；界面配置不代表检索已运行')
panel(im,'01.png',(1900,850,2500,1070),(300,320,1320,480),[(40,65,550,175)])
frames.append(im)
im=frame('S03','From a local summary to a wider context','先聚焦摘要，再拉回关系图；不是实际RAG返回结果')
panel(im,'03.png',(950,580,2390,1160),(100,240,1720,660),[(45,190,390,400)])
frames.append(im)
im=frame('S04','Follow the links between documents','Design exploration · 沿文档关系访问的设计设想')
panel(im,'04.png',(80,370,1100,790),(90,260,1010,580),[(60,145,295,295),(415,250,650,395)])
panel(im,'04.png',(1135,280,1610,915),(1170,220,660,690),[(15,540,470,630)])
frames.append(im)
im=frame('S05','RAG can still be a Tool','保留工具入口，强调Agent Action中的Toolbox挂载位置')
panel(im,'02.png',(875,225,1550,815),(150,230,900,650),[(55,430,625,550)])
panel(im,'02.png',(1920,190,2500,1260),(1100,220,680,690))
frames.append(im)
im=frame('S06','Retrieval + Graph Navigation','Design exploration · 两种方式协作，不模拟协同运行')
text(im,(150,235),'RETRIEVAL / TOOLBOX',24,BLUE)
text(im,(1050,235),'DOCUMENT RELATIONSHIPS',24,BLUE)
panel(im,'02.png',(900,520,1505,780),(120,310,760,540))
panel(im,'04.png',(100,380,1090,800),(1030,310,770,540))
text(im,(935,510),'+',50,BLUE)
frames.append(im)
sheet=Image.new('RGB',(1440,3*430),'#e4e9f2')
for i,im in enumerate(frames):
    im.save(OUT/f'S{i+1:02}.png')
    thumb=im.resize((720,405),Image.Resampling.LANCZOS)
    sheet.paste(thumb,((i%2)*720,(i//2)*430))
sheet.save(OUT/'M-06_分镜总览_v01.png')
print('Generated six full-size frames and contact sheet.')
