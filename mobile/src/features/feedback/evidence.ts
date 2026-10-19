/** Conservative evidence comparison; shared corpus lives in backend/testdata. */
const space=/[\u0009-\u000d\u001c-\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/u;
const word=/^[\p{L}']+$/u;
const number=/^[+-]?\p{Nd}+(?:[.,]\p{Nd}+)?$/u;
const unit=/^(?:[yzafpnumcdhkMGTPEZYµμ]?)(?:m|g|s|A|K|mol|cd|Hz|N|Pa|J|W|C|V|F|S|Wb|T|H|L|B|b|eV)$/iu;
const numbers=new Set(['zero','one','two','three','four','five','six','seven','eight','nine','ten','hundred','thousand','million','billion','trillion','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety','half','quarter','dozen']);
const shortProse=new Set(['it','so','as','in','no','we','he','my','by','to','on','or','of','if','an','be','up','do','us','me','at','am']);
const words=(v:string)=>v.normalize('NFC').split(space).filter(Boolean);
function token(value:string,previous=''){
 let t=value.replace(/(?<=[\p{L}])[‘’ʼ](?=[\p{L}])/gu,"'");
 const quantity=/\p{Nd}/u.test(previous)||!!previous&&previous.toLowerCase().split('-').every(p=>numbers.has(p));
 const raw=t.endsWith('.')&&!t.endsWith('..')?t.slice(0,-1):t;
 const camel=/[\p{Ll}][\p{Lu}]/u.test(raw),acronym=raw.length>1&&raw===raw.toUpperCase()&&raw!==raw.toLowerCase();
 if(raw!==t&&((word.test(raw)&&[...raw].length>1&&!camel&&!acronym)||number.test(raw)))t=raw;
 const stem=t.replace(/[,;:!?]+$/u,''),suffix=t.slice(stem.length);
 if(quantity||(unit.test(stem)&&!(['at','as','am'].includes(stem.toLowerCase())&&!quantity)))return t;
 const chars=[...stem],ambiguousShort=chars.length===2&&/\p{Lu}/u.test(chars[0])&&/\p{Ll}/u.test(chars[1])&&!shortProse.has(stem.toLowerCase());
 const cap=!!stem&&stem===stem.toUpperCase()&&stem!==stem.toLowerCase();
 if(chars.length>1&&word.test(stem)&&!/[\p{Ll}][\p{Lu}]/u.test(stem)&&!cap&&!ambiguousShort)t=stem.toLowerCase()+suffix;
 return t;
}
export function quoteTokens(v:string){const parts=words(v);return parts.map((t,i)=>token(t,i?parts[i-1]:''));}
export function quotesEqual(a:string,b:string){const x=quoteTokens(a),y=quoteTokens(b);return !!x.length&&x.length===y.length&&x.every((t,i)=>t===y[i]);}
export function verifiedExcerpt(a:string,b:string):string|null{
 const source=words(b),candidate=quoteTokens(a),values=quoteTokens(b);
 if(!candidate.length)return null;
 for(let i=0;i<=source.length-candidate.length;i++)if(candidate.every((t,j)=>t===values[i+j]))return source.slice(i,i+candidate.length).join(' ');
 return null;
}
/** Object key order is not identity; array order still is. */
export function structurallyEqual(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>structurallyEqual(v,b[i]));
 const x=a as Record<string,unknown>,y=b as Record<string,unknown>,keys=Object.keys(x);
 return keys.length===Object.keys(y).length&&keys.every(k=>Object.prototype.hasOwnProperty.call(y,k)&&structurallyEqual(x[k],y[k]));
}
