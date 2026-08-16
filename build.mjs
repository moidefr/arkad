/**
 * Assemble le dossier `www/` : c'est lui qu'on publie sur le web et qu'on
 * embarque dans l'APK. Aucune dépendance — il n'y a rien à compiler, juste
 * à rassembler.
 *
 * Une page statique par catégorie et par jeu s'ajoute à la copie : une URL
 * qu'on peut partager ou mettre en favori, générée depuis le même catalogue
 * que l'accueil — un jeu de plus dans catalogue.js, une page de plus ici,
 * sans rien toucher d'autre.
 */
import { cp, rm, mkdir, writeFile } from 'node:fs/promises'
import { CATEGORIES } from './src/catalogue.js'

const FICHIERS = ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest', 'icone.svg', 'src', 'CNAME']

await rm('www', { recursive: true, force: true })
await mkdir('www', { recursive: true })
for (const f of FICHIERS) {
  await cp(f, `www/${f}`, { recursive: true })
}

// --- Pages par catégorie et par jeu -----------------------------------------

const echappe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/**
 * Même squelette que l'index.html écrit à la main — canevas et script de
 * démarrage identiques — mais avec un titre et une description propres à la
 * page. Les chemins sont absolus (`/…`) : contrairement à la racine, ces
 * pages vivent à une profondeur variable (un ou deux dossiers), et un chemin
 * relatif s'y romprait.
 */
const page = (titre, description) => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <meta name="theme-color" content="#0b0e0d">
  <title>${echappe(titre)}</title>
  <meta name="description" content="${echappe(description)}">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <canvas id="scene"></canvas>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`

let pages = 0
for (const cat of CATEGORIES) {
  await mkdir(`www/${cat.id}`, { recursive: true })
  await writeFile(`www/${cat.id}/index.html`, page(`${cat.nom} — ARKAD`, cat.detail))
  pages++
  for (const jeu of cat.jeux) {
    const dossier = `www/${cat.id}/${jeu.id}`
    await mkdir(dossier, { recursive: true })
    await writeFile(`${dossier}/index.html`, page(`${jeu.nom} — ARKAD`, jeu.pitch))
    pages++
  }
}

console.log(`www/ prêt (${FICHIERS.length} entrées, ${pages} pages générées)`)
