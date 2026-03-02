#!/usr/bin/env node
/**
 * Post-build check: fail if any JS chunk in dist/assets exceeds MAX_CHUNK_BYTES.
 * Used for perf budget enforcement in CI.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist', 'assets')
const MAX_CHUNK_BYTES = 2 * 1024 * 1024 // 2 MB

if (!fs.existsSync(DIST)) {
  console.warn('check-chunk-size: dist/assets not found (skip)')
  process.exit(0)
}

const files = fs.readdirSync(DIST).filter((f) => f.endsWith('.js'))
let failed = false
for (const file of files) {
  const fp = path.join(DIST, file)
  const stat = fs.statSync(fp)
  if (stat.size > MAX_CHUNK_BYTES) {
    console.error(`Chunk ${file} exceeds ${MAX_CHUNK_BYTES / 1024 / 1024} MB: ${(stat.size / 1024 / 1024).toFixed(2)} MB`)
    failed = true
  }
}
if (failed) {
  process.exit(1)
}
console.log('check-chunk-size: all chunks within limit')
