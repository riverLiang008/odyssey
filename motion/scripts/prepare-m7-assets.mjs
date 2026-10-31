import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../../motion-assets/projects/odyssey-how001/m-07/',import.meta.url);
const target=new URL('../public/m7/',import.meta.url),out=new URL('../out/',import.meta.url);
await mkdir(target,{recursive:true});await mkdir(out,{recursive:true});
await copyFile(new URL('HOW001-M07.m4a',source),new URL('narration.m4a',target));
const sourceSrt=await readFile(new URL('HOW001-M07.srt',source),'utf8');
const blocks=sourceSrt.trim().split(/\r?\n\s*\r?\n/);
const copy=[
  'Patterns describe how Agents work together. Workflows organize the steps and logic.',
  'Knowledge Space manages knowledge resources. ToolBox organizes the actions Agents can take.',
];
if(blocks.length!==2)throw new Error('M7 subtitle source changed: expected two cues; review mapping before export.');
const result=blocks.map((block,i)=>{
  const lines=block.split(/\r?\n/);
  if(!lines[1]?.includes('-->'))throw new Error('Invalid M7 cue timing');
  return [lines[0],lines[1],copy[i]].join('\n');
}).join('\n\n')+'\n';
await writeFile(new URL('motion-007.srt',out),result);
console.log('M7 narration and corrected delivery subtitles prepared; source files unchanged.');
