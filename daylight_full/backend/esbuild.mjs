import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: ['src/handlers/trips.ts', 'src/handlers/plan.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: true
})

execSync('cd dist && zip -qr trips.zip trips.js', { stdio: 'inherit' })
execSync('cd dist && zip -qr plan.zip plan.js', { stdio: 'inherit' })
console.log('Built Lambda zips')
