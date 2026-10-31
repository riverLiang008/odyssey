import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../../motion-assets/projects/odyssey-how001/r-012/',import.meta.url);
const target=new URL('../public/r012/',import.meta.url),out=new URL('../out/',import.meta.url);
await mkdir(target,{recursive:true});await mkdir(out,{recursive:true});
await copyFile(new URL('HOW001-R012.m4a',source),new URL('narration.m4a',target));
let srt=await readFile(new URL('HOW001-R012.srt',source),'utf8');
// Script-aligned delivery copy; original recording and SRT remain unchanged.
for(const [from,to] of [
  ['When we decide on agent workflow, we usually focus on the steps it runs, but a four-agent','When we design an Agent Workflow, we usually focus on the steps it runs. But a full Agent'],
  ['system has much more than a workflow.','system has much more than a Workflow.'],
  ['It also has settings, gareals, and ways for a different agent to work together.','It also has Settings, Guardrails, and ways for different Agents to work together.'],
  ['If all this information is spread across different pages and settings, it is hard to see the',"If all this information is spread across different pages and settings, it's hard to see the"],
]) srt=srt.replace(from,to);
await writeFile(new URL('r-012.srt',out),srt);
console.log('R-012 audio and script-aligned subtitle copy prepared; source files unchanged.');
