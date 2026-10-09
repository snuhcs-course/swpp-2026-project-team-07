import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const root = fileURLToPath(new URL('../src/layouts/', import.meta.url));
const allowed = /^(react|react-native|react-native-safe-area-context|expo-status-bar|expo-router(?:\/.*)?|@expo\/vector-icons(?:\/.*)?)$/;
export function checkLayoutSource(file, source) {
  const failures = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const report = (node, message) => failures.push(`${relative(root, file)}:${ast.getLineAndCharacterOfPosition(node.getStart()).line + 1}: ${message}`);
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const name = node.moduleSpecifier.text;
      const types = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly;
      const target = resolve(dirname(file), name);
      const inside = target.startsWith(root);
      const publicTypes = types && (file === resolve(root, 'contracts.ts') || target === resolve(root, '../contracts'));
      if (!(name.startsWith('.') ? inside || publicTypes : allowed.test(name))) report(node, `Layout may not import ${name}. Use a shared controller contract.`);
      if (name === 'expo-router' && !file.endsWith('Navigation.tsx')) report(node, 'Only navigation shells may import Expo Router. Screen commands come from controllers.');
      if (name === 'react-native' && /\b(NativeModules|TurboModuleRegistry)\b/.test(node.getText(ast))) report(node, 'Native handles belong to shared hosts.');
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(ast);
      if (['require', 'fetch', 'globalThis.fetch', 'window.fetch', 'import'].includes(name)) report(node, 'Layout code cannot load integrations dynamically or make network requests.');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast); return failures;
}
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(resolve(dir, item.name)) : /\.tsx?$/.test(item.name) ? [resolve(dir, item.name)] : []); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const failures = files(root).flatMap(file => checkLayoutSource(file, readFileSync(file, 'utf8')));
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('Layout boundaries passed.');
}
