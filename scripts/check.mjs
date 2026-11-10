import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const ignored=new Set(['node_modules','.git','data','output','.codex-remote-attachments','.agents','.codex']);
async function check(dir){
 let count=0;
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(ignored.has(entry.name))continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())count+=await check(file);
  else if(/\.(?:js|mjs)$/u.test(entry.name)){
   const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});
   if(result.status!==0){process.stderr.write(result.stderr||String(result.error));process.exit(1);}count++;
  }
 }
 return count;
}
console.log(`Syntax checked ${await check('.')} JavaScript files.`);
