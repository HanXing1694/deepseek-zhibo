// Isolated game integration tests only: no external model, collector or audio.
import './deepseek-fixture.mjs';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const realNow=Date.now;
Date.now=()=>{try{return realNow()+Number(readFileSync(path.join(process.env.WHALE_DATA_DIR,'clock-offset'),'utf8'));}catch{return realNow();}};
