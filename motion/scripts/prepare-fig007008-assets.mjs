import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=path.join(root,'motion-assets/projects/odyssey-how001/fig-007-008');
const dest=path.join(root,'motion/public/fig007008');
await mkdir(dest,{recursive:true});
await mkdir(path.join(root,'motion/out'),{recursive:true});
await copyFile(path.join(source,'HOW001-FIG007-FIG008.m4a'),path.join(dest,'narration.m4a'));
const original=await readFile(path.join(source,'HOW001-FIG007-FIG008.srt'),'utf8');
const texts=[
  'I found similar problems in other parts of the interface.',
  'For example, a Workflow needs more than a Canvas that shows its steps.',
  'Users also need to move between different levels, check node settings, and know what they are',
  'editing.',
  'In the same way, Knowledge Space needs more than a graph of document links.',
  'Users also need to manage documents, read their content, and understand how they fit',
  'into the bigger knowledge structure.',
];
const cues=original.trim().split(/\r?\n\s*\r?\n/);
if(cues.length!==texts.length)throw new Error('Unexpected source cue count');
const result=cues.map((cue,i)=>{const lines=cue.split(/\r?\n/);if(!lines[1]?.includes('-->'))throw new Error('Invalid cue');return `${lines[0]}\n${lines[1]}\n${texts[i]}`;}).join('\n\n')+'\n';
await writeFile(path.join(root,'motion/out/fig-007-008.srt'),result);
