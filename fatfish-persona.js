import {readFileSync} from 'node:fs';
// The user-authored full prompt is the canonical source for defaults and live updates.
export const fatfishPersona=readFileSync(new URL('./fatfish-persona.txt',import.meta.url),'utf8').trim();
