import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: [
    'src/handlers/trips.ts', 
    'src/handlers/plan.ts',
    'src/handlers/search.ts',
    'src/handlers/searchAdmin.ts'
  ],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
  },
  minify: true
})

function zipFile(srcFile, destZip) {
  const absSrc = path.resolve(srcFile)
  const absDest = path.resolve(destZip)
  if (process.platform === 'win32') {
    // Use built-in PowerShell zip on Windows
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Compress-Archive -Path '${absSrc}' -DestinationPath '${absDest}' -Force"`,
      { stdio: 'inherit' }
    )
  } else {
    // Use zip CLI on macOS/Linux
    execSync(`zip -qr ${absDest} ${path.basename(absSrc)}`, {
      stdio: 'inherit',
      cwd: path.dirname(absSrc),
    })
  }
}

zipFile('dist/trips.js', 'dist/trips.zip')
zipFile('dist/plan.js', 'dist/plan.zip')
zipFile('dist/search.js', 'dist/search.zip')
zipFile('dist/searchAdmin.js', 'dist/searchAdmin.zip')
console.log('Built Lambda zips')
