import OpenCC from 'opencc-js';
const simplify=OpenCC.Converter({from:'t',to:'cn'});
const traditional=OpenCC.Converter({from:'cn',to:'tw'});
export const normalizeSong=value=>simplify(String(value||'').normalize('NFKC')).toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
export function songVariants(value){return [...new Set([String(value),simplify(String(value)),traditional(String(value))])];}
export function matchesSongQuery(query,song){
 const key=normalizeSong(query),title=song.name||song.title,artist=song.artist||song.singer;
 return !!title&&!!artist&&[title,title+artist,artist+title,artist+'的'+title].some(v=>normalizeSong(v)===key);
}
