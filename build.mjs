/**
 * Assemble le dossier `www/` : c'est lui qu'on publie sur le web et qu'on
 * embarque dans l'APK. Aucune dépendance — il n'y a rien à compiler, juste
 * à rassembler.
 */
import { cp, rm, mkdir } from 'node:fs/promises'

const FICHIERS = ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest', 'icone.svg', 'src', 'CNAME']

await rm('www', { recursive: true, force: true })
await mkdir('www', { recursive: true })
for (const f of FICHIERS) {
  await cp(f, `www/${f}`, { recursive: true })
}
console.log(`www/ prêt (${FICHIERS.length} entrées)`)
