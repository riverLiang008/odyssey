from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import math
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'review-v01';OUT.mkdir(exist_ok=True)
B='#4f6bff';INK='#192435';M='#6c7890'
def text(im,x,y,s,size=28,color=INK):ImageDraw.Draw(im).text((x,y),s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
def node(d,p):
 x,y=p;d.ellipse((x-14,y-14,x+14,y+14),fill='white',outline=B,width=4)
def arrow(d,a,b):
 ang=math.atan2(b[1]-a[1],b[0]-a[0]);x,y=b[0]-16*math.cos(ang),b[1]-16*math.sin(ang)
 d.line([a,(x,y)],fill=B,width=3)
 d.polygon([(x,y),(x-12*math.cos(ang-.5),y-12*math.sin(ang-.5)),(x-12*math.cos(ang+.5),y-12*math.sin(ang+.5))],fill=B)
def icon(d,cx,cy,i):
 if i==0:pts=[(cx-110,cy),(cx,cy),(cx+110,cy)];edges=[(0,1),(1,2)]
 elif i==1:pts=[(cx,cy)];edges=[]
 elif i==2:pts=[(cx,cy),(cx-95,cy),(cx+95,cy),(cx,cy-65),(cx,cy+65)];edges=[(0,1),(0,2),(0,3),(0,4)]
 else:pts=[(cx,cy-60),(cx+95,cy),(cx,cy+60),(cx-95,cy)];edges=[(0,1),(1,2),(2,3),(3,0)]
 for a,b in edges:arrow(d,pts[a],pts[b])
 for p in pts:node(d,p)
def frame(title,caption):
 im=Image.new('RGB',(1920,1080),'#f7f9ff');text(im,100,50,'ODYSSEY / PATTERN DESIGN',22,B);text(im,100,110,title,48);text(im,100,188,caption,24,M);text(im,100,985,'静态分镜审阅 · 非运行画面 · 中文注释不进入成片',22,M);return im
frames=[]
im=frame('A simpler starting point','从自由结构的想法出发；不是已上线功能的运行演示');d=ImageDraw.Draw(im)
pts=[(450,450),(850,350),(1300,430),(1500,650),(1000,780),(500,730),(950,540)]
for a,b in [(0,1),(1,2),(2,3),(3,4),(4,5),(5,0),(0,6),(6,2),(6,4)]:arrow(d,pts[a],pts[b])
for p in pts:node(d,p)
frames.append(im)
for idx,title in enumerate(['Ready-made Patterns','Choose a structure, then configure']):
 im=frame(title,'四个选项按旁白次序排列；依次高亮，不构成四阶段执行链');d=ImageDraw.Draw(im)
 for i,label in enumerate(['Linear','Solo','Hub and Spoke','Circle']):
  x=150+(i%2)*850;y=285+(i//2)*285
  d.rounded_rectangle((x,y,x+770,y+240),22,fill='white',outline=B if idx==0 or i==2 else '#dce3f2',width=3)
  text(im,x+30,y+20,label,32);icon(d,x+390,y+143,i)
 frames.append(im)
im=frame('Less setup. Clearer choices.','回到所提供SVG的Pattern选择区；保留原标签，不假装连续操作')
src=Image.open(OUT/'Create-Modal-reference.png').crop((330,430,1110,735));src=src.resize((1560,610),Image.Resampling.LANCZOS);im.paste(src,(180,270));frames.append(im)
sheet=Image.new('RGB',(1440,860),'#e5eaf3')
for i,im in enumerate(frames):im.save(OUT/f'S{i+1:02}.png');sheet.paste(im.resize((720,405),Image.Resampling.LANCZOS),((i%2)*720,(i//2)*430))
sheet.save(OUT/'M-09_分镜总览_v01.png');print('Generated four storyboard frames.')
