import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../../motion-assets/projects/odyssey-how001/fig-002/',import.meta.url),target=new URL('../public/fig002/',import.meta.url),out=new URL('../out/',import.meta.url);
await mkdir(target,{recursive:true});await mkdir(out,{recursive:true});
await copyFile(new URL('HOW001-FIG002.m4a',source),new URL('narration.m4a',target));
await copyFile(new URL('LLM Call.svg',source),new URL('llm-call.svg',target));
const sourceSrt=await readFile(new URL('HOW001-FIG002.srt',source),'utf8');
const blocks=sourceSrt.trim().split(/\r?\n\s*\r?\n/);
const words=["This also means an LLM doesn't always need to be a separate top-level Node.",'If we only want to call a language model once, we can treat it as a Tool used by another node.'];
if(blocks.length!==2)throw new Error('FIG-002 source subtitle count changed; review mapping.');
await writeFile(new URL('fig-002.srt',out),blocks.map((block,i)=>{
  const lines=block.split(/\r?\n/);if(!lines[1]?.includes('-->'))throw new Error('Invalid FIG-002 cue timing');
  return [lines[0],lines[1],words[i]].join('\n');
}).join('\n\n')+'\n');
console.log('FIG-002 original audio/SVG and corrected delivery subtitle copy prepared; source files unchanged.');
