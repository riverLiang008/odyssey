"""R-012概念分镜，静态审阅，不是运行截图。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'review-v01';OUT.mkdir(exist_ok=True)
BLUE='#4f6bff';INK='#192435';MUTED='#6c7890';BORDER='#dce3f2';BG='#f7f9ff'
def text(im,x,y,s,size=28,color=INK):
 ImageDraw.Draw(im).text((x,y),s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
def box(im,b,title=None,fill='white',outline=BORDER):
 ImageDraw.Draw(im).rounded_rectangle(b,22,fill=fill,outline=outline,width=3)
 if title:text(im,b[0]+28,b[1]+22,title,29)
def line(im,a,b):
 d=ImageDraw.Draw(im);d.line([a,b],fill=BLUE,width=4);x,y=b;d.polygon([(x,y),(x-14,y-8),(x-14,y+8)],fill=BLUE)
def flow(im,x,y,w=1200):
 box(im,(x,y,x+w,y+270),'WORKFLOW')
 step=(w-120)/3
 for i in range(3):
  left=x+40+i*step
  box(im,(left,y+105,left+step-45,y+210),fill='#eef2ff',outline=BLUE)
  text(im,left+12,y+132,f'Step {i+1}',18 if w<700 else 29)
  if i<2:line(im,(left+step-38,y+158),(left+step-8,y+158))
def card(im,x,y,w,title,desc):
 box(im,(x,y,x+w,y+180),title,fill='#f0f4ff')
 text(im,x+28,y+100,desc,23,MUTED)
def frame(n,title,caption):
 im=Image.new('RGB',(1920,1080),BG)
 text(im,100,45,'ODYSSEY / SYSTEM DESIGN',22,BLUE)
 text(im,100,100,title,49)
 text(im,100,183,caption,25,MUTED)
 text(im,100,982,f'S{n:02} · 概念分镜审阅；非运行画面 · 底部字幕安全区',23,MUTED)
 return im
frames=[]
im=frame(1,'A Workflow describes the steps','先建立执行步骤；示意节点不代表固定产品节点')
flow(im,330,390,1260);frames.append(im)
im=frame(2,'An Agent system is more than a Workflow','拉开视野：Workflow是系统的一部分，外围仍有其他维度')
box(im,(170,290,1750,880),'AGENT SYSTEM',outline=BLUE)
flow(im,380,430,1160)
text(im,410,775,'Settings     ·     Guardrails     ·     Agent collaboration',29,MUTED)
frames.append(im)
im=frame(3,'More than the steps it runs','配置与协作并列呈现，不连接为Workflow的后续步骤')
box(im,(120,280,1800,900),'AGENT SYSTEM',outline=BLUE)
flow(im,330,370,1260)
card(im,190,670,480,'Settings','System configuration')
card(im,720,670,480,'Guardrails','Rules and boundaries')
card(im,1250,670,480,'Agent collaboration','Ways to work together')
frames.append(im)
im=frame(4,'Information across different pages','同一批信息分布到不同页面；不模拟具体产品表单')
box(im,(110,320,700,830),'PAGE A')
flow(im,140,420,530)
box(im,(750,280,1260,790),'PAGE B')
card(im,780,390,450,'Settings','System configuration')
card(im,780,590,450,'Guardrails','Rules and boundaries')
box(im,(1310,360,1810,870),'PAGE C')
card(im,1335,490,450,'Agent collaboration','Ways to work together')
frames.append(im)
im=frame(5,'Hard to see the whole system','保留分散的上下文；下一支M-01再提出二维组织方案')
for x,y,w,label in [(150,360,510,'Workflow'),(740,300,450,'Settings'),(1340,410,430,'Agent collaboration')]:
 box(im,(x,y,x+w,y+(430 if label=='Settings' else 340)),'PAGE',outline=BORDER)
 box(im,(x+25,y+110,x+w-25,y+230),label,fill='#eef2ff',outline=BLUE)
box(im,(765,565,1165,710),'Guardrails',fill='#eef2ff',outline=BLUE)
text(im,480,820,'One system. Several disconnected views.',38,BLUE)
frames.append(im)
sheet=Image.new('RGB',(1440,1290),'#e5eaf3')
for i,im in enumerate(frames):
 im.save(OUT/f'S{i+1:02}.png');sheet.paste(im.resize((720,405),Image.Resampling.LANCZOS),((i%2)*720,(i//2)*430))
text(sheet,785,1000,'R-012 / 静态分镜',32)
text(sheet,785,1060,'保留编号 · 改用Motion',25,MUTED)
sheet.save(OUT/'R-012_分镜总览_v01.png')
print('Generated 5 frames and overview.')
