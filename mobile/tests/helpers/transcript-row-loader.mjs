import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {transpile} from './transpile.mjs';
import {resolve as baseResolve,load as baseLoad} from './domain-loader.mjs';
// Coverage setup updated with OpenAI Codex; see the coverage setup prompt entry.
const original=new URL('../../src/screens/TranscriptCorrections.tsx',import.meta.url);
const fragment=new URL('./transcript-row-fragment.tsx',import.meta.url);
export function resolve(specifier,context,nextResolve){
 if(specifier==='react-native'||specifier==='react-native-reanimated'||specifier==='react-native-svg'||specifier.endsWith('/design/frame')||specifier.endsWith('/design/icons')||specifier.endsWith('/design/PanView')||specifier.endsWith('/rehearsal/analysis')||specifier.endsWith('/design/theme')||specifier.endsWith('/presentations/transcriptSuggestions'))return {url:new URL('./transcript-row-native.mjs',import.meta.url).href,shortCircuit:true};
 const resolved=baseResolve(specifier,context.parentURL===fragment.href?{...context,parentURL:original.href}:context,nextResolve);
 return resolved.url===original.href?{url:fragment.href,shortCircuit:true}:resolved;
}
export function load(url,context,nextLoad){
 if(url===fragment.href){
  // Render the actual row in isolation. Unrelated recording/navigation hosts are
  // excluded, without copying or substituting the component under test.
  const text=readFileSync(original,'utf8');
  const ast=ts.createSourceFile(url,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const imports=new Set(['react','react-native','react-native-reanimated','react-native-svg','../design/frame','../design/icons','../design/PanView','../design/tokens','../design/theme','../features/presentations/transcriptSuggestions','../domain/format','../domain/lines','../features/rehearsal/analysis']);
  const pieces=ast.statements.filter(n=>ts.isImportDeclaration(n)?imports.has(n.moduleSpecifier.text):ts.isFunctionDeclaration(n)?['LineRow','CorrectionChoices','TranscriptPanel'].includes(n.name?.text):ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='styles')).map(n=>ts.isVariableStatement(n)?'const styles=StyleSheet.create({'+n.declarationList.declarations[0].initializer.arguments[0].properties.filter(p=>new Set(['txHead','txHeadText','txRule','txCheck','txPlay','txBox','empty','alts','correctionChoices','reveal','revealText','lineRow','playCol','lineTime','lineText','flag','alts','altLead','altChip','altText','edge','edgeText','txVisit']).has(p.name.getText(ast))).map(p=>p.getText(ast)).join(',')+'});':n.getText(ast));
  const source=pieces.join('\n')+'\nexport {LineRow,CorrectionChoices,TranscriptPanel};';
  // This extracted fragment cannot establish coverage of the complete screen.
  // Give it a helper URL so the real screen stays in scope without false credit.
  return {format:'module',shortCircuit:true,source:transpile(source,fragment.href)};
 }
 return baseLoad(url,context,nextLoad);
}
