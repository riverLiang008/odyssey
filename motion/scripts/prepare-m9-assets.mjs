import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
const source=new URL('../../motion-assets/projects/odyssey-how001/m-09/',import.meta.url),target=new URL('../public/m9/',import.meta.url),out=new URL('../out/',import.meta.url);
await mkdir(target,{recursive:true});await mkdir(out,{recursive:true});
await copyFile(new URL('HOW001-M9.m4a',source),new URL('narration.m4a',target));
await copyFile(new URL('Create Modal.svg',source),new URL('create-modal.svg',target));
const sourceSrt=await readFile(new URL('HOW001-M9.srt',source),'utf8');
const blocks=sourceSrt.trim().split(/\r?\n\s*\r?\n/);
const words=['So I decided to make the design simpler.','Instead of asking users to build any structure from scratch,','the system would offer a few ready-made Patterns:','Linear, Solo, Hub and Spoke, and Circle.','This gave users a little less freedom,','but made the system much easier to understand and set up.'];
if(blocks.length!==words.length)throw new Error('M9 source subtitle count changed; review timing mapping.');
await writeFile(new URL('motion-009.srt',out),blocks.map((block,i)=>{
  const lines=block.split(/\r?\n/);if(!lines[1]?.includes('-->'))throw new Error('Invalid M9 timing');
  return [lines[0],lines[1],words[i]].join('\n');
}).join('\n\n')+'\n');
console.log('M9 audio, original SVG and corrected subtitle copy prepared; source files unchanged.');
