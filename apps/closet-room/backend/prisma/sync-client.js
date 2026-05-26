/**
 * Prisma Client Sync Script
 *
 * prisma generate는 custom output 경로(src/generated/prisma-client)에만 생성하고,
 * 런타임에 사용되는 기본 경로(.prisma/client)는 업데이트하지 않습니다.
 * 이 스크립트가 두 경로를 동기화합니다.
 *
 * 사용: prisma generate 후 자동 실행 (package.json prisma:generate 참조)
 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../src/generated/prisma-client');
const clientPkg = path.dirname(require.resolve('@prisma/client/package.json'));
const dst = path.resolve(clientPkg, '../../.prisma/client');

// V1: custom output 미사용 → src가 없으면 skip
if (!fs.existsSync(src)) {
  console.log('ℹ️  Custom Prisma output disabled — skipping sync.');
  return;
}

const files = [
  'index.js', 'index.d.ts',
  'index-browser.js',
  'default.js', 'default.d.ts',
  'client.js', 'client.d.ts',
  'edge.js', 'edge.d.ts',
  'wasm.js', 'wasm.d.ts',
  'schema.prisma', 'package.json',
  'query_engine_bg.js', 'query_engine_bg.wasm',
  'wasm-edge-light-loader.mjs', 'wasm-worker-loader.mjs',
];

let synced = 0;
for (const file of files) {
  const srcFile = path.join(src, file);
  const dstFile = path.join(dst, file);
  if (fs.existsSync(srcFile)) {
    fs.mkdirSync(path.dirname(dstFile), { recursive: true });
    fs.copyFileSync(srcFile, dstFile);
    synced++;
  }
}

// Native engine binary (platform-specific)
const nativeFiles = fs.readdirSync(src).filter(f => f.startsWith('libquery_engine'));
for (const file of nativeFiles) {
  fs.copyFileSync(path.join(src, file), path.join(dst, file));
  synced++;
}

console.log(`✅ Prisma client synced: ${synced} files (${src} → ${dst})`);
