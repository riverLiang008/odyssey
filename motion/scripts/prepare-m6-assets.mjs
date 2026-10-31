import {copyFile, mkdir} from 'node:fs/promises';
const source = new URL('../../motion-assets/projects/odyssey-how001/m-06/', import.meta.url);
const target = new URL('../public/m6/', import.meta.url);
const out = new URL('../out/', import.meta.url);
await mkdir(target, {recursive: true});
await mkdir(out, {recursive: true});
for (const name of ['01.png', '02.png', '03.png', '04.png']) {
  await copyFile(new URL(name, source), new URL(name, target));
}
await copyFile(new URL('HOW001-M6-2.m4a', source), new URL('narration.m4a', target));
await copyFile(new URL('HOW001-M6-2.srt', source), new URL('motion-006.srt', out));
console.log('M-06 screenshots, narration and subtitles prepared.');
