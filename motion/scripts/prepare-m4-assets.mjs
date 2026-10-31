import {copyFile, mkdir} from 'node:fs/promises';
const source = new URL('../../motion-assets/projects/odyssey-how001/m-04/', import.meta.url);
const target = new URL('../public/m4/', import.meta.url);
const out = new URL('../out/', import.meta.url);
await mkdir(target, {recursive: true});
await mkdir(out, {recursive: true});
await copyFile(new URL('HOW001-M4-1.m4a', source), new URL('narration.m4a', target));
await copyFile(new URL('HOW001-M4-1.srt', source), new URL('motion-004.srt', out));
console.log('M-04 audio and subtitles prepared.');
