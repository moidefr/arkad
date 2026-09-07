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
import { classable } from './src/classement/coefficients.js'
import { origineSeule } from './outils/adresse.mjs'

const FICHIERS = ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest', 'icone.svg', 'src', 'CNAME']

await rm('www', { recursive: true, force: true })
await mkdir('www', { recursive: true })
for (const f of FICHIERS) {
  await cp(f, `www/${f}`, { recursive: true })
}

// --- L'adresse du dos de la borne -------------------------------------------
//
// `src/classement/config.js` est vide dans le dépôt : un fork ne doit pas
// hériter du projet Supabase de quelqu'un d'autre, et une clé ne se met pas
// dans un dépôt même quand elle est publique. On la réécrit ici, dans la
// copie, à partir de l'environnement — et sans elle tout marche pareil, les
// classements se disent simplement hors ligne.

const SUPABASE_URL = origineSeule(process.env.SUPABASE_URL)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const litteral = (s) => JSON.stringify(String(s))

await writeFile(
  'www/src/classement/config.js',
  `/* Fichier écrit par build.mjs — voir src/classement/config.js. */
export const SUPABASE_URL = ${litteral(SUPABASE_URL)}
export const SUPABASE_ANON_KEY = ${litteral(SUPABASE_ANON_KEY)}
export const enLigne = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
`,
)

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

// Le classement a ses pages, comme les catégories : `/classement/` pour le
// général, `/classement/<jeu>/` pour un jeu précis. Sans ces dernières, une
// adresse que `route.js` sait pourtant lire tomberait sur un 404 de
// l'hébergeur — le routage est côté client, mais le fichier doit exister.
await mkdir('www/classement', { recursive: true })
await writeFile('www/classement/index.html', page('Classement — ARKAD', 'le podium général, et un classement par jeu'))
pages++
for (const jeu of CATEGORIES.flatMap((c) => c.jeux).filter(classable)) {
  await mkdir(`www/classement/${jeu.id}`, { recursive: true })
  await writeFile(
    `www/classement/${jeu.id}/index.html`,
    page(`Classement ${jeu.nom} — ARKAD`, `les meilleurs scores de ${jeu.nom} : ${jeu.pitch}`),
  )
  pages++
}

console.log(
  `www/ prêt (${FICHIERS.length} entrées, ${pages} pages générées, classements ${SUPABASE_URL ? 'branchés' : 'hors ligne'})`,
)
