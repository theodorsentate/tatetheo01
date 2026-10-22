// Turns the single-file demo build into page content for hosts that supply
// their own <html>/<head>/<body> skeleton (e.g. a claude.ai artifact).
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('dist-demo/index.html', 'utf8')
const head = src.match(/<head>([\s\S]*?)<\/head>/)[1]
const body = src.match(/<body>([\s\S]*?)<\/body>/)[1]
const keepHead = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
writeFileSync('dist-demo/burgee.html', `${keepHead.trim()}\n${body.trim()}\n`)
console.log('dist-demo/burgee.html', (Buffer.byteLength(keepHead + body) / 1024).toFixed(0), 'KB')
