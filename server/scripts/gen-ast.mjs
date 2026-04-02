#!/usr/bin/env node
/**
 * Generates TypeScript AST classes from YAML definitions.
 * Usage: node scripts/gen-ast.mjs <yaml-dir> <output-dir>
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

const yamlDir = process.argv[2] || '../packages/zuspec-fe-pss/ast';
const outDir = process.argv[3] || 'src/core/ast/generated';

const allClasses = [];
const allEnums = [];
const allFlags = [];
const allStructs = [];

function mapType(cppType) {
  if (!cppType) return 'unknown';
  const t = cppType.trim();
  const primitives = {
    'string': 'string', 'bool': 'boolean',
    'int8_t': 'number', 'uint8_t': 'number',
    'int16_t': 'number', 'uint16_t': 'number',
    'int32_t': 'number', 'uint32_t': 'number',
    'int64_t': 'number', 'uint64_t': 'number',
  };
  if (primitives[t]) return primitives[t];
  const ptrMatch = t.match(/^(?:UP|SP|P)<(.+)>$/);
  if (ptrMatch) return `${mapType(ptrMatch[1])} | null`;
  const listMatch = t.match(/^list<(.+)>$/);
  if (listMatch) return `${mapType(listMatch[1]).replace(/ \| null$/, '')}[]`;
  const mapMatch = t.match(/^map<(.+),\s*(.+)>$/);
  if (mapMatch) return `Map<${mapType(mapMatch[1])}, ${mapType(mapMatch[2])}>`;
  return t;
}

function isPointerType(cppType) {
  return cppType ? /^(?:UP|SP|P)</.test(cppType.trim()) : false;
}
function isListType(cppType) {
  return cppType ? cppType.trim().startsWith('list<') : false;
}
function isMapType(cppType) {
  return cppType ? cppType.trim().startsWith('map<') : false;
}

function getDefault(cppType, init) {
  if (init !== undefined && init !== null) {
    if (init === '0' || init === 'false') return isPointerType(cppType) ? 'null' : (cppType === 'bool' ? 'false' : '0');
    if (init === 'true') return 'true';
    if (init === '-1') return '-1';
    return String(init);
  }
  const t = cppType?.trim();
  if (!t) return 'null';
  if (isPointerType(t)) return 'null';
  if (isListType(t)) return '[]';
  if (isMapType(t)) return 'new Map()';
  if (t === 'string') return "''";
  if (t === 'bool') return 'false';
  if (/int\d+_t|uint\d+_t/.test(t)) return '0';
  return 'null';
}

function parseFieldDef(fname, fval) {
  let type = null, isCtor = true, init = undefined, visit = true;
  if (typeof fval === 'string') {
    type = fval;
  } else if (Array.isArray(fval)) {
    for (const item of fval) {
      if (typeof item === 'string') type = item;
      else if (typeof item === 'object' && item !== null) {
        const k = Object.keys(item)[0];
        if (k === 'type') type = item[k];
        else if (k === 'is_ctor') isCtor = Boolean(item[k]);
        else if (k === 'init') init = String(item[k]);
        else if (k === 'visit') visit = Boolean(item[k]);
      }
    }
  } else if (typeof fval === 'object' && fval !== null) {
    type = fval.type || null;
    if ('is_ctor' in fval) isCtor = Boolean(fval.is_ctor);
    if ('init' in fval) init = String(fval.init);
    if ('visit' in fval) visit = Boolean(fval.visit);
  }
  if (!type) type = fname;
  if (type && isListType(type)) isCtor = false;
  return { name: fname, type, isCtor, init, visit };
}

// Parse YAML files
const yamlFiles = readdirSync(yamlDir).filter(f => f.endsWith('.yaml')).sort();
for (const file of yamlFiles) {
  const content = readFileSync(join(yamlDir, file), 'utf-8');
  const doc = parseYaml(content);
  if (!doc) continue;

  if (doc.classes) {
    for (const cls of doc.classes) {
      if (typeof cls === 'string') {
        allClasses.push({ name: cls, superClass: null, data: [], doc: '' });
      } else {
        const name = Object.keys(cls)[0];
        const body = cls[name] || {};
        const fields = [];
        if (body.data && Array.isArray(body.data)) {
          for (const field of body.data) {
            if (!field) continue;
            const fn = Object.keys(field)[0].trim();
            fields.push(parseFieldDef(fn, field[fn]));
          }
        }
        allClasses.push({ name, superClass: body.super || null, data: fields, doc: body.doc || '' });
      }
    }
  }

  if (doc.enums) {
    for (const en of doc.enums) {
      const name = Object.keys(en)[0];
      const values = en[name].map(v =>
        (typeof v === 'string' ? v : Object.keys(v)[0]).replace(/#.*$/, '').trim()
      );
      allEnums.push({ name, values });
    }
  }

  if (doc.flags) {
    for (const fl of doc.flags) {
      const name = Object.keys(fl)[0];
      const values = fl[name].map(v =>
        (typeof v === 'string' ? v : Object.keys(v)[0]).replace(/#.*$/, '').trim()
      );
      allFlags.push({ name, values });
    }
  }

  if (doc.structs) {
    for (const st of doc.structs) {
      const name = Object.keys(st)[0];
      const body = st[name] || {};
      const fields = [];
      if (body.data && Array.isArray(body.data)) {
        for (const field of body.data) {
          if (!field) continue;
          const fn = Object.keys(field)[0].trim();
          fields.push(parseFieldDef(fn, field[fn]));
        }
      }
      allStructs.push({ name, data: fields, doc: body.doc || '' });
    }
  }
}

mkdirSync(outDir, { recursive: true });

// Topological sort
function topoSort(classes) {
  const sorted = [];
  const visited = new Set();
  const byName = new Map(classes.map(c => [c.name, c]));
  function visit(cls) {
    if (visited.has(cls.name)) return;
    visited.add(cls.name);
    if (cls.superClass && byName.has(cls.superClass)) visit(byName.get(cls.superClass));
    sorted.push(cls);
  }
  for (const cls of classes) visit(cls);
  return sorted;
}
const sortedClasses = topoSort(allClasses);

// --- enums.ts ---
let enumsCode = '// Auto-generated - DO NOT EDIT\n\n';
for (const en of allEnums) {
  enumsCode += `export enum ${en.name} {\n`;
  for (let i = 0; i < en.values.length; i++) enumsCode += `  ${en.values[i]} = ${i},\n`;
  enumsCode += '}\n\n';
}
writeFileSync(join(outDir, 'enums.ts'), enumsCode);

// --- flags.ts ---
let flagsCode = '// Auto-generated - DO NOT EDIT\n\n';
for (const fl of allFlags) {
  flagsCode += `export enum ${fl.name} {\n  None = 0,\n`;
  for (let i = 0; i < fl.values.length; i++) flagsCode += `  ${fl.values[i]} = ${1 << i},\n`;
  flagsCode += '}\n\n';
}
writeFileSync(join(outDir, 'flags.ts'), flagsCode);

// --- structs.ts ---
let structsCode = '// Auto-generated - DO NOT EDIT\n\n';
for (const st of allStructs) {
  structsCode += `export interface ${st.name} {\n`;
  for (const f of st.data) structsCode += `  ${f.name}: ${mapType(f.type)};\n`;
  structsCode += '}\n\n';
  structsCode += `export function mk${st.name}(${st.data.map(f => `${f.name}: ${mapType(f.type)} = ${getDefault(f.type, f.init)}`).join(', ')}): ${st.name} {\n`;
  structsCode += `  return { ${st.data.map(f => f.name).join(', ')} };\n}\n\n`;
}
writeFileSync(join(outDir, 'structs.ts'), structsCode);

// --- classes.ts ---
let cc = '// Auto-generated - DO NOT EDIT\n\n';
cc += "import type { ASTVisitor } from './visitor';\n";
cc += "import { type Location } from './structs';\n";
cc += "import * as enums from './enums';\n";
cc += "import * as flags from './flags';\n";
cc += 'export { enums, flags };\n\n';

for (const cls of sortedClasses) {
  const ext = cls.superClass ? ` extends ${cls.superClass}` : '';
  cc += `export class ${cls.name}${ext} {\n`;
  for (const f of cls.data) {
    let tsType = mapType(f.type);
    let defVal = getDefault(f.type, f.init);
    if (allEnums.find(e => e.name === f.type)) {
      tsType = `enums.${f.type}`;
      defVal = `enums.${f.type}.${allEnums.find(e => e.name === f.type).values[0]}`;
    } else if (allFlags.find(fl => fl.name === f.type)) {
      tsType = `flags.${f.type}`;
      defVal = `flags.${f.type}.None`;
    }
    cc += `  ${f.name}: ${tsType} = ${defVal};\n`;
  }
  cc += '\n';
  const ctorFields = cls.data.filter(f => f.isCtor);
  if (ctorFields.length > 0) {
    const params = ctorFields.map(f => {
      let t = mapType(f.type);
      if (allEnums.find(e => e.name === f.type)) t = `enums.${f.type}`;
      else if (allFlags.find(fl => fl.name === f.type)) t = `flags.${f.type}`;
      return `${f.name}: ${t}`;
    });
    cc += `  constructor(${params.join(', ')}) {\n`;
    if (cls.superClass) cc += '    super();\n';
    for (const f of ctorFields) cc += `    this.${f.name} = ${f.name};\n`;
    cc += '  }\n\n';
  }
  cc += `  accept<T>(visitor: ASTVisitor<T>): T | null {\n`;
  cc += `    return visitor.visit${cls.name}?.(this) ?? null;\n`;
  cc += '  }\n}\n\n';
}
writeFileSync(join(outDir, 'classes.ts'), cc);

// --- visitor.ts ---
let vc = '// Auto-generated - DO NOT EDIT\n\n';
for (const cls of sortedClasses) vc += `import type { ${cls.name} } from './classes';\n`;
vc += '\nexport interface ASTVisitor<T> {\n';
for (const cls of sortedClasses) vc += `  visit${cls.name}?(node: ${cls.name}): T;\n`;
vc += '}\n\n';
vc += 'export class BaseASTVisitor<T> implements ASTVisitor<T> {\n';
vc += '  protected defaultResult(): T | null { return null; }\n\n';
for (const cls of sortedClasses) {
  vc += `  visit${cls.name}(node: ${cls.name}): T {\n`;
  vc += cls.superClass
    ? `    return this.visit${cls.superClass}(node as any);\n`
    : '    return this.defaultResult() as T;\n';
  vc += '  }\n\n';
}
vc += '}\n';
writeFileSync(join(outDir, 'visitor.ts'), vc);

// --- factory.ts ---
let fc = '// Auto-generated - DO NOT EDIT\n\nimport * as cls from \'./classes\';\nimport * as enums from \'./enums\';\nimport * as flags from \'./flags\';\n\nexport class ASTFactory {\n';
for (const c of sortedClasses) {
  const ctorFields = c.data.filter(f => f.isCtor);
  const params = ctorFields.map(f => {
    let t = mapType(f.type);
    if (allEnums.find(e => e.name === f.type)) t = `enums.${f.type}`;
    else if (allFlags.find(fl => fl.name === f.type)) t = `flags.${f.type}`;
    return `${f.name}: ${t}`;
  });
  fc += `  mk${c.name}(${params.join(', ')}): cls.${c.name} {\n`;
  fc += ctorFields.length > 0
    ? `    return new cls.${c.name}(${ctorFields.map(f => f.name).join(', ')});\n`
    : `    return new cls.${c.name}();\n`;
  fc += '  }\n\n';
}
fc += '}\n';
writeFileSync(join(outDir, 'factory.ts'), fc);

// --- index.ts ---
writeFileSync(join(outDir, 'index.ts'),
  "// Auto-generated - DO NOT EDIT\n\nexport * from './enums';\nexport * from './flags';\nexport * from './structs';\nexport * from './classes';\nexport * from './visitor';\nexport * from './factory';\n");

console.log(`Generated AST: ${allEnums.length} enums, ${allFlags.length} flags, ${allStructs.length} structs, ${allClasses.length} classes`);
