import {copyFile, mkdir} from 'node:fs/promises';
const source = new URL('../../motion-assets/projects/odyssey-how001/m-03/', import.meta.url);
const target = new URL('../public/m3/', import.meta.url);
const out = new URL('../out/', import.meta.url);
await mkdir(target, {recursive: true});
await mkdir(out, {recursive: true});
await copyFile(new URL('HOW001-M3-2.m4a', source), new URL('narration.m4a', target));
await copyFile(new URL('HOW001-M3-2.srt', source), new URL('motion-003.srt', out));
console.log('M-03 audio and subtitles prepared.');
