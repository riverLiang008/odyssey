"""M-07四个核心概念静态分镜。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'review-v01';OUT.mkdir(exist_ok=True)
BLUE='#4f6bff';INK='#192435';MUTED='#6c7890';BORDER='#dce3f2'
def text(im,x,y,s,size=28,color=INK):
 ImageDraw.Draw(im).text((x,y),s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
items=[('Patterns','How Agents work together'),('Workflows','Steps and logic'),('Knowledge Space','Knowledge resources'),('ToolBox','Actions Agents can take')]
def icon(im,x,y,n,active):
 d=ImageDraw.Draw(im);color=BLUE if active else '#9ba9c4'
 if n==0:
  for a,b in [((60,45),(145,20)),((60,45),(145,80))]:d.line([(x+a[0],y+a[1]),(x+b[0],y+b[1])],fill=color,width=4)
  for a,b in [(60,45),(145,20),(145,80)]:d.ellipse((x+a-13,y+b-13,x+a+13,y+b+13),fill='white',outline=color,width=4)
 elif n==1:
  for i in range(3):
   left=x+25+i*70;d.rounded_rectangle((left,y+27,left+45,y+73),9,fill='white',outline=color,width=3)
   if i<2:d.line([(left+45,y+50),(left+68,y+50)],fill=color,width=3)
 elif n==2:
  for a,b in [(40,30),(140,10),(130,75)]:d.rounded_rectangle((x+a,y+b,x+a+40,y+b+45),5,fill='white',outline=color,width=3)
  d.line([(x+80,y+53),(x+140,y+35)],fill=color,width=3);d.line([(x+80,y+60),(x+130,y+95)],fill=color,width=3)
 else:
  d.rounded_rectangle((x+28,y+24,x+190,y+104),10,fill='white',outline=color,width=4)
  d.rounded_rectangle((x+80,y+3,x+135,y+26),6,outline=color,width=4)
  for a in [60,105,150]:d.line([(x+a,y+49),(x+a,y+78)],fill=color,width=6)
frames=[]
for state in range(5):
 im=Image.new('RGB',(1920,1080),'#f7f9ff');d=ImageDraw.Draw(im)
 text(im,100,50,'ODYSSEY / FOUR CORE CONCEPTS',22,BLUE)
 text(im,100,112,'Four ideas. Clearer responsibilities.',48)
 text(im,100,187,'四个概念依次强调，最终并列收束；不是执行顺序',25,MUTED)
 for i,(title,desc) in enumerate(items):
  x=130+(i%2)*850;y=285+(i//2)*285;active=state==4 or state==i
  d.rounded_rectangle((x,y,x+810,y+245),22,fill='white',outline=BLUE if active else BORDER,width=4 if active else 2)
  icon(im,x+25,y+72,i,active)
  text(im,x+260,y+65,title,37,INK if active else MUTED)
  text(im,x+260,y+135,desc,27,BLUE if active else MUTED)
 text(im,100,987,f'S{state+1:02} · 静态分镜审阅 · 中文注释不进入成片',22,MUTED)
 im.save(OUT/f'S{state+1:02}.png');frames.append(im)
sheet=Image.new('RGB',(1440,1290),'#e5eaf3')
for i,im in enumerate(frames):sheet.paste(im.resize((720,405),Image.Resampling.LANCZOS),((i%2)*720,(i//2)*430))
text(sheet,790,1010,'M-07 / Four Core Concepts',28)
text(sheet,790,1070,'四卡依次强调 → 同屏收束',25,MUTED)
sheet.save(OUT/'M-07_分镜总览_v01.png')
print('Generated five storyboard frames.')
