import {mkdir,copyFile} from 'node:fs/promises';
const source=new URL('../../motion-assets/projects/odyssey-how001/edit-002/',import.meta.url);
const dest=new URL('../public/edit002/',import.meta.url);
await mkdir(dest,{recursive:true});
await mkdir(new URL('../out/',import.meta.url),{recursive:true});
await copyFile(new URL('HOW001-EDIT002.m4a',source),new URL('narration.m4a',dest));
await copyFile(new URL('HOW001-EDIT002.srt',source),new URL('../out/edit-002.srt',import.meta.url));
