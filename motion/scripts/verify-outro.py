"""核验无声片尾并复制到正式素材目录。仓库根目录运行。"""
from pathlib import Path
import subprocess,json,shutil
root=Path.cwd();video=root/'motion/out/odyssey-outro-v01.mp4'
tools=root/'node_modules/.pnpm/@remotion+compositor-win32-x64-msvc@4.0.502/node_modules/@remotion/compositor-win32-x64-msvc'
meta=json.loads(subprocess.run([str(tools/'ffprobe.exe'),'-v','error','-show_streams','-show_format','-of','json',str(video)],capture_output=True,text=True,check=True).stdout)
assert len(meta['streams'])==1
v=meta['streams'][0]
assert (v['codec_type'],v['codec_name'],v['width'],v['height'],v['r_frame_rate'],int(v['nb_frames']))==('video','h264',1920,1080,'30/1',165)
subprocess.run([str(tools/'ffmpeg.exe'),'-v','error','-i',str(video),'-c:v','rawvideo','-f','null','-'],capture_output=True,text=True,check=True)
dest=root/'advertise/HOW/001/materials/HOW001_Odyssey_Outro_v01.mp4'
shutil.copy2(video,dest)
print(json.dumps({'duration':meta['format']['duration'],'frames':v['nb_frames'],'bytes':dest.stat().st_size,'audio':False,'file':str(dest)}))
