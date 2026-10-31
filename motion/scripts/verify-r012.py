"""检查R-012导出规格、字幕时间及完整解码。仓库根目录运行。"""
from pathlib import Path
import subprocess,json,re
root=Path.cwd();out=root/'motion/out'
tools=root/'node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.502/node_modules/@remotion/compositor-win32-x64-msvc'
def run(name,args):
    result=subprocess.run([str(tools/name),*map(str,args)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stderr)
    return result
run('ffmpeg.exe',['-y','-i',out/'r-012-review.mp4','-map','0:v:0','-c:v','copy','-an',out/'r-012.mp4'])
data={}
for name in ['r-012-review.mp4','r-012.mp4']:
    p=out/name
    meta=json.loads(run('ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',p]).stdout)
    v=next(s for s in meta['streams'] if s['codec_type']=='video')
    assert (v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==(1920,1080,'30/1',843)
    assert any(s['codec_type']=='audio' for s in meta['streams'])==('review' in name)
    run('ffmpeg.exe',['-v','error','-i',p,'-c:v','rawvideo','-c:a','pcm_s16le','-f','null','-'])
    data[name]={'duration':meta['format']['duration'],'bytes':p.stat().st_size,'streams':[s['codec_type'] for s in meta['streams']],'frames':v['nb_frames']}
source=(root/'motion-assets/projects/odyssey-how001/r-012/HOW001-R012.srt').read_text(encoding='utf-8-sig')
delivery=(out/'r-012.srt').read_text(encoding='utf-8-sig')
assert re.findall(r'\d\d:\d\d:\d\d,\d{3}',source)==re.findall(r'\d\d:\d\d:\d\d,\d{3}',delivery)
(out/'r012-verification.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps(data))
