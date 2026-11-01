import {copyFile,mkdir} from 'node:fs/promises';
const dest=new URL('../public/sk002/',import.meta.url);
await mkdir(dest,{recursive:true});
await copyFile(new URL('../../motion-assets/projects/odyssey-how001/sk-002/whiteboard_exported_image (5).png',import.meta.url),new URL('sketch.png',dest));
