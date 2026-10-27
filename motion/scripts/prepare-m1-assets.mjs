import {copyFile, mkdir, readdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const source = fileURLToPath(new URL('../../motion-assets/projects/odyssey-how001/m-01/', import.meta.url));
const target = fileURLToPath(new URL('../public/m1-v2/', import.meta.url));
const out = fileURLToPath(new URL('../out/', import.meta.url));
await mkdir(target, {recursive: true});
await mkdir(out, {recursive: true});
const files = await readdir(source);
for (const [suffix, output] of [
  ['SK-01_v01.png', 'sketch.png'], ['UI-05_v01.png', 'system.png'],
  ['how001-m1-1.m4a', 'narration-1.m4a'], ['how001-fig-001-1.m4a', 'narration-2.m4a'],
]) {
  const matches = files.filter((name) => name.replace(/^\u200b/, '') === suffix);
  if (matches.length !== 1) throw new Error(`Expected exactly one asset: ${suffix}`);
  await copyFile(join(source, matches[0]), join(target, output));
}
// Source subtitles remain untouched; only the second clip gets a local offset.
const toMs = (value) => {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(value);
  if (!match) throw new Error(`Invalid subtitle time: ${value}`);
  const [, h, m, s, ms] = match.map(Number);
  return ((h * 60 + m) * 60 + s) * 1000 + ms;
};
const stamp = (ms) => {
  const hh = Math.floor(ms / 3600000);
  const mm = Math.floor(ms / 60000) % 60;
  const ss = Math.floor(ms / 1000) % 60;
  return `${[hh, mm, ss].map((v) => String(v).padStart(2, '0')).join(':')},${String(ms % 1000).padStart(3, '0')}`;
};
let index = 0;
let previousEnd = 0;
const merged = [];
for (const [name, offset] of [['how001-m1-1.srt', 0], ['how001-fig-001-1.srt', 40400]]) {
  const raw = await readFile(join(source, name), 'utf8');
  for (const block of raw.trim().split(/\r?\n\s*\r?\n/)) {
    const [, time, ...lines] = block.split(/\r?\n/);
    const match = /^(\S+) --> (\S+)$/.exec(time ?? '');
    if (!match || !lines.length) throw new Error(`Invalid SRT block in ${name}`);
    const start = toMs(match[1]) + offset;
    const end = toMs(match[2]) + offset;
    if (start < previousEnd || end <= start) throw new Error(`Overlapping or reversed subtitle in ${name}`);
    previousEnd = end;
    merged.push(`${++index}\n${stamp(start)} --> ${stamp(end)}\n${lines.join('\n')}`);
  }
}
await writeFile(join(out, 'motion-001-v2.srt'), merged.join('\n\n') + '\n', 'utf8');
console.log('M-01 assets prepared in motion/public/m1-v2 (generated, ignored).');
