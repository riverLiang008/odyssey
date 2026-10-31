from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'review-v01';OUT.mkdir(exist_ok=True)
B='#4f6bff';INK='#192435';M='#6c7890'
def text(im,x,y,s,size=28,color=INK):ImageDraw.Draw(im).text((x,y),s,font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',size),fill=color)
def box(im,r,label,accent=True):
 ImageDraw.Draw(im).rounded_rectangle(r,20,fill='white',outline=B if accent else '#dce3f2',width=3)
 text(im,r[0]+28,r[1]+25,label,32)
def frame(title,caption):
 im=Image.new('RGB',(1920,1080),'#f7f9ff');text(im,100,50,'ODYSSEY / LLM AS A TOOL',22,B);text(im,100,110,title,48);text(im,100,185,caption,24,M);text(im,100,985,'静态分镜审阅 · 设计示意 · 中文注释不进入成片',22,M);return im
def task(im,x,y,w=720):
 box(im,(x,y,x+w,y+390),'TASK / NODE')
 text(im,x+35,y+96,'A predefined operation',25,M)
 box(im,(x+55,y+160,x+w-55,y+300),'LLM Call · Tool')
 text(im,x+85,y+235,'One model call',26,B)
def panel(im,focus=None):
 source=Image.open(OUT/'LLM-Call-reference.png').convert('RGB').crop((0,0,384,560))
 if focus:
  dark=Image.blend(source,Image.new('RGB',source.size,'#26334d'),.22)
  dark.paste(source.crop(focus),focus[:2]);ImageDraw.Draw(dark).rounded_rectangle(focus,7,outline=B,width=3);source=dark
 source=source.resize((442,644),Image.Resampling.LANCZOS);im.paste(source,(1320,245))
frames=[]
im=frame('Not always a top-level Node','LLM不必总以独立顶层节点出现；不表示禁止这种结构')
for x,label in [(180,'Node'),(750,'LLM'),(1320,'Node')]:box(im,(x,440,x+400,620),label,accent=label=='LLM')
d=ImageDraw.Draw(im);d.line([(580,530),(750,530)],fill=B,width=3);d.line([(1150,530),(1320,530)],fill=B,width=3)
text(im,560,740,'An independent LLM Node is one option.',31,M);frames.append(im)
im=frame('One model call, inside another node','把单次模型调用封装为工具；容器层级明确')
task(im,500,345,920);frames.append(im)
im=frame('An LLM call can be a Tool','左侧概念结构，右侧为提供的工具配置设计稿')
task(im,130,360,950);panel(im,(14,150,370,313));frames.append(im)
im=frame('Configure the call and its output mapping','只展示配置，不模拟模型返回或系统执行')
task(im,130,360,950);panel(im,(14,479,370,539));frames.append(im)
sheet=Image.new('RGB',(1440,860),'#e5eaf3')
for i,im in enumerate(frames):im.save(OUT/f'S{i+1:02}.png');sheet.paste(im.resize((720,405),Image.Resampling.LANCZOS),((i%2)*720,(i//2)*430))
sheet.save(OUT/'FIG-002_分镜总览_v01.png');print('Generated four storyboard frames.')
