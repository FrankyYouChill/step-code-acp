// A focused pre-publication guard, not a substitute for a full security review.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const files=git('ls-files','--cached','--others','--exclude-standard','-z').split('\0').filter(Boolean);
const rules=[
  ['private key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['API credential',/\bsk-[A-Za-z0-9_-]{24,}/],
  ['GitHub credential',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/],
  ['machine-specific assistant path',/\/(?:Users|home)\/[^\s/]+\/\.(?:codex|claude)\//i],
  ['automated authorship footer',/^co-authored-by:.*(?:codex|chatgpt|openai)/im],
];
const failures=[];
for (const file of files) {
  let content;
  try {content=await readFile(resolve(root,file),'utf8');} catch(error) {if(error.code==='ENOENT')continue;throw error;}
  for (const [label,pattern] of rules) if(pattern.test(content))failures.push(`${file}: ${label}`);
}
const branch=git('branch','--show-current');
if (/^(?:codex|chatgpt|claude)\//i.test(branch)) failures.push('Use a neutral public branch name');
const attribution=git('log','-1','--format=%an <%ae>%n%cn <%ce>%n%B');
if (/^co-authored-by:.*(?:codex|chatgpt|openai)/im.test(attribution)) failures.push('Latest commit contains incidental tool attribution');
if (/^(?:codex|chatgpt|claude)(?:\s|$)/im.test(attribution)) failures.push('Latest commit contains incidental automated authorship');
if(failures.length) {console.error(failures.join('\n'));process.exit(1);}
console.log(`Public-file and metadata checks passed (${files.length} files).`);
