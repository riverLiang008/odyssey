"""核对M-06交付元数据并解码检查；在仓库根目录运行。"""
from pathlib import Path
import subprocess,json,hashlib
root=Path.cwd()
bin=root/'node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.502/node_modules/@remotion/compositor-win32-x64-msvc'
out=root/'motion/out'
def run(name,args):
    return subprocess.run([str(bin/name),*map(str,args)],capture_output=True,text=True,check=True)
run('ffmpeg.exe',['-y','-i',out/'motion-006-review.mp4','-map','0:v:0','-c:v','copy','-an',out/'motion-006.mp4'])
data={}
for name in ['motion-006-review.mp4','motion-006.mp4']:
    p=out/name
    meta=json.loads(run('ffprobe.exe',['-v','error','-show_streams','-show_format','-of','json',p]).stdout)
    video=next(s for s in meta['streams'] if s['codec_type']=='video')
    assert (video['width'],video['height'],video['r_frame_rate'],int(video['nb_frames']))==(1920,1080,'30/1',1401)
    assert any(s['codec_type']=='audio' for s in meta['streams'])==('review' in name)
    run('ffmpeg.exe',['-v','error','-i',p,'-c:v','rawvideo','-c:a','pcm_s16le','-f','null','-'])
    data[name]={'duration':meta['format']['duration'],'bytes':p.stat().st_size,'streams':[s['codec_type'] for s in meta['streams']],'frames':video['nb_frames']}
assert (out/'motion-006.srt').read_bytes()==(root/'motion-assets/projects/odyssey-how001/m-06/HOW001-M6-2.srt').read_bytes()
(out/'m6-verification.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
print(json.dumps(data))
