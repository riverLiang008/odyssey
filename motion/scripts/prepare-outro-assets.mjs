import {copyFile,mkdir} from 'node:fs/promises';
const target=new URL('../public/outro/',import.meta.url);
await mkdir(target,{recursive:true});
await copyFile(new URL('../../doc/assets/brand/odyssey-logo.png',import.meta.url),new URL('odyssey-logo.png',target));
console.log('Original Odyssey brand artwork prepared.');
