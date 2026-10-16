import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {resolve as baseResolve,load as baseLoad} from './domain-loader.mjs';
export function resolve(specifier,context,nextResolve){
 if(specifier==='react-native'||specifier==='react-native-reanimated'||specifier==='react-native-svg'||specifier.endsWith('/design/frame')||specifier.endsWith('/design/icons')||specifier.endsWith('/design/PanView')||specifier.endsWith('/design/theme')||specifier.endsWith('/rehearsal/analysis'))return {url:new URL('./transcript-row-native.mjs',import.meta.url).href,shortCircuit:true};
 return baseResolve(specifier,context,nextResolve);
}
export function load(url,context,nextLoad){
 if(url.endsWith('/screens/RehearseScreen.tsx')){
  // Render the actual row in isolation. Unrelated recording/navigation hosts are
  // excluded, without copying or substituting the component under test.
  const text=readFileSync(new URL(url),'utf8');
  const ast=ts.createSourceFile(url,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const imports=new Set(['react','react-native','react-native-reanimated','react-native-svg','../design/frame','../design/icons','../design/PanView','../design/theme','../design/tokens','../domain/format','../domain/lines','../features/rehearsal/analysis']);
  const pieces=ast.statements.filter(n=>ts.isImportDeclaration(n)?imports.has(n.moduleSpecifier.text):ts.isFunctionDeclaration(n)?['LineRow','CorrectionChoices'].includes(n.name?.text):ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='styles')).map(n=>ts.isVariableStatement(n)?'const styles=StyleSheet.create({'+n.declarationList.declarations[0].initializer.arguments[0].properties.filter(p=>new Set(['reveal','revealText','lineRow','playCol','lineTime','lineText','flag','alts','altLead','altChip','altText','edge','edgeText','txVisit']).has(p.name.getText(ast))).map(p=>p.getText(ast)).join(',')+'});':n.getText(ast));
  const source=pieces.join('\n')+'\nexport {LineRow,CorrectionChoices};';
  return {format:'module',shortCircuit:true,source:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText};
 }
 return baseLoad(url,context,nextLoad);
}
