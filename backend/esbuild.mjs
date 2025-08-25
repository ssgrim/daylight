import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

mkdirSync('dist', { recursive: true })

await build({
  entryPoints: [
    'src/handlers/trips.ts', 
    'src/handlers/plan.ts',
    'src/handlers/health.ts',
    'src/handlers/secret-rotation.ts'
  ],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
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
zipFile('dist/health.js', 'dist/health.zip')
zipFile('dist/secret-rotation.js', 'dist/secret-rotation.zip')
console.log('Built Lambda zips')
