/**
 * Fabrique la console d'écoute des bandes-son : une page autonome qui joue
 * les soixante-quinze morceaux et montre leur partition défiler.
 *
 * Le point important est qu'elle **n'a pas sa propre copie de la musique**.
 * Les quatre modules de `src/` sont recopiés tels quels dans la page, imports
 * et exports retirés : ce qu'on entend ici est donc, par construction, ce que
 * la borne joue. Une console qui réimplémenterait la synthèse mentirait au
 * premier réglage changé, et on ne s'en apercevrait jamais.
 *
 *   node outils/console-bandes.mjs [chemin de sortie]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const SORTIE = process.argv[2] ?? resolve(RACINE, 'www/bandes.html')

/** Recopie un module en retirant ce qui n'a de sens qu'entre fichiers. */
const inline = (chemin) =>
  readFileSync(resolve(RACINE, chemin), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export (const|let|function|class) /gm, '$1 ')
    .replace(/^export \{[^}]*\}[^\n]*\n/gm, '')
    .trim()

const MUSIQUE = ['src/hasard.js', 'src/musique/composition.js', 'src/musique/table.js', 'src/musique/joueur.js']
  .map((f) => `// ——— ${f} ———————————————————————————————————————\n${inline(f)}`)
  .join('\n\n')

/** Les dix mondes de BRÈCHE, dans l'ordre de la table. */
const MONDES = [
  ['LA COUR', 'simple, carré, on apprend'],
  ['LA FORGE', 'chaud, martelé'],
  ['LA CARRIÈRE', 'lourd, minéral'],
  ["L’ATELIER", 'régulier, mécanique'],
  ['LA CRUE', 'pressé, montant'],
  ['LE GEL', 'clair, suspendu'],
  ["L’ORAGE", 'gros, sombre'],
  ['LA FAILLE', 'profond, tendu'],
  ['LA FOURNAISE', 'tout à la fois'],
  ['LE VIDE', 'grand, presque rien'],
]

const page = `<title>Bandes-son d’ARKAD</title>
<style>
  /* La console reprend la palette de la borne telle quelle : un terminal à
     phosphore ambré est un parti pris entier, pas un thème parmi deux. Tout
     est donc peint explicitement, et il n'y a pas de variante claire. */
  :root {
    --fond: #0b0e0d;
    --panneau: #141a18;
    --bord: #27332e;
    --texte: #d6e0d9;
    --faible: #5d6f66;
    --accent: #ffb43c;
    --vert: #5ddb8a;
    --cyan: #49d3cf;
    --violet: #b98cff;
    --rouge: #ff5f56;
    --mono: ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", Menlo, Consolas, monospace;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--fond);
    color: var(--texte);
    font-family: var(--mono);
    font-size: 14px;
    line-height: 1.55;
    /* Le grain du tube : une trame de points, pas un dégradé. Assez pour que
       le fond ne soit pas un aplat mort, pas assez pour concurrencer le
       texte — c'est du bruit de fond, pas un motif. */
    background-image: radial-gradient(rgba(93, 111, 102, 0.16) 1px, transparent 1px);
    background-size: 7px 7px;
  }

  .page { max-width: 1080px; margin: 0 auto; padding: 32px 20px 96px; }

  /* — L'en-tête ——————————————————————————————————————————— */

  header { border-bottom: 2px solid var(--bord); padding-bottom: 24px; }

  h1 {
    margin: 0;
    font-size: clamp(28px, 6vw, 46px);
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--accent);
    text-wrap: balance;
  }

  .sous { margin: 10px 0 0; color: var(--faible); max-width: 62ch; }
  .sous b { color: var(--texte); font-weight: 700; }

  .compte {
    display: flex; flex-wrap: wrap; gap: 0 28px;
    margin-top: 18px; color: var(--faible);
    font-size: 12px; letter-spacing: 0.09em; text-transform: uppercase;
  }
  .compte b { color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; }

  /* — Le bandeau de lecture ——————————————————————————————————
     Il colle en haut : on parcourt une liste de soixante-quinze lignes en
     écoutant, et perdre de vue ce qui joue rendrait la liste inutilisable. */

  .transport {
    position: sticky; top: 0; z-index: 5;
    margin: 24px 0 0;
    background: var(--panneau);
    border: 2px solid var(--bord);
  }
  .transport.actif { border-color: var(--accent); }

  .tete { display: flex; align-items: center; gap: 16px; padding: 14px 16px; }

  button.jouer {
    flex: none;
    width: 56px; height: 44px;
    background: var(--fond);
    border: 2px solid var(--faible);
    color: var(--texte);
    font-family: var(--mono); font-size: 15px; font-weight: 700;
    cursor: pointer;
  }
  button.jouer:hover, button.jouer:focus-visible { border-color: var(--accent); color: var(--accent); }
  button.jouer:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .quoi { min-width: 0; flex: 1; }
  .quoi .titre {
    font-size: 17px; font-weight: 700; letter-spacing: 0.06em;
    color: var(--accent);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .quoi .titre.rien { color: var(--faible); }
  .quoi .fiche {
    color: var(--faible); font-size: 12px;
    letter-spacing: 0.06em; text-transform: uppercase;
    font-variant-numeric: tabular-nums;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* Le rouleau : une lane par voix, le temps qui file vers la gauche. C'est
     ce qui rend visible que ces morceaux sont écrits et non enregistrés. */
  canvas { display: block; width: 100%; height: 132px; border-top: 2px solid var(--bord); }

  /* — La liste ————————————————————————————————————————————— */

  section { margin-top: 40px; }

  .barre {
    display: flex; align-items: baseline; gap: 14px;
    padding-bottom: 8px; border-bottom: 2px solid var(--bord);
  }
  .barre .rang {
    font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
    color: var(--fond); background: var(--faible);
    padding: 1px 7px; font-variant-numeric: tabular-nums;
  }
  .barre h2 { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: 0.11em; }
  .barre .note { color: var(--faible); font-size: 12px; }

  .tableau { width: 100%; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; min-width: 620px; }

  th {
    text-align: left; padding: 9px 10px;
    font-size: 11px; font-weight: 700; letter-spacing: 0.11em;
    text-transform: uppercase; color: var(--faible);
    border-bottom: 1px solid var(--bord);
  }
  th.n, td.n { text-align: right; font-variant-numeric: tabular-nums; }

  td { padding: 7px 10px; border-bottom: 1px solid var(--bord); vertical-align: middle; }
  tr:hover td { background: var(--panneau); }
  tr.joue td { background: var(--panneau); }
  tr.joue td:first-child { box-shadow: inset 3px 0 0 var(--accent); }

  td.cmd { width: 46px; padding-left: 6px; }
  button.piste {
    width: 34px; height: 30px;
    background: transparent; border: 1px solid var(--bord);
    color: var(--faible); font-family: var(--mono); font-size: 12px;
    cursor: pointer;
  }
  button.piste:hover, button.piste:focus-visible { border-color: var(--accent); color: var(--accent); }
  button.piste:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  tr.joue button.piste { border-color: var(--accent); color: var(--accent); }

  td.nom { font-weight: 700; letter-spacing: 0.04em; }
  tr.joue td.nom { color: var(--accent); }
  td.id { color: var(--faible); font-size: 12px; }
  td.trait { color: var(--faible); font-size: 12px; letter-spacing: 0.05em; }

  footer {
    margin-top: 56px; padding-top: 22px;
    border-top: 2px solid var(--bord);
    color: var(--faible); max-width: 68ch;
  }
  footer code { color: var(--texte); }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media (max-width: 620px) {
    .page { padding: 22px 14px 72px; }
    td.trait, th.trait { display: none; }
    table { min-width: 0; }
  }
</style>

<div class="page">
  <header>
    <h1>BANDES-SON D’ARKAD</h1>
    <p class="sous">
      Soixante-quinze morceaux, et <b>pas un seul fichier audio</b>. Chacun tient
      en huit champs — tempo, gamme, tonique, ambiance, graine — dont le
      compositeur déduit seize mesures. Cette page ne rejoue pas un
      enregistrement : elle fait tourner le compositeur et le joueur de la borne,
      recopiés tels quels. Ce que tu entends est ce que le jeu joue.
    </p>
    <p class="compte">
      <span><b>50</b> pour BRÈCHE, cinq par monde</span>
      <span><b>25</b> pour le reste de la borne</span>
      <span><b>0</b> octet téléchargé</span>
    </p>
  </header>

  <div class="transport" id="transport">
    <div class="tete">
      <button class="jouer" id="bascule" aria-label="Lecture">▶</button>
      <div class="quoi">
        <div class="titre rien" id="titre">rien ne joue</div>
        <div class="fiche" id="fiche">choisis une bande dans la liste</div>
      </div>
    </div>
    <canvas id="rouleau" width="2048" height="264" aria-hidden="true"></canvas>
  </div>

  <div id="listes"></div>

  <footer>
    <p>
      La graine fait tout ce que la fiche ne dit pas : le motif de chant, la
      marche d’accords, les notes de passage de la basse. Deux lignes qui ne
      diffèrent que par leur graine donnent deux morceaux qui n’ont rien à voir
      — c’est ce qui permet d’en tenir cinquante dans une page de table.
    </p>
    <p style="margin-top:12px">
      <code>compose()</code> est une fonction pure : elle ne fait aucun son, elle
      rend une liste d’évènements. C’est ce qui permet de vérifier sous
      <code>node --test</code> qu’aucune bande n’est muette, qu’aucune note ne
      sort de sa gamme et qu’il n’y en a pas deux identiques — sans navigateur,
      et sans tendre l’oreille.
    </p>
  </footer>
</div>

<script type="module">
${MUSIQUE}

// ——— La console ————————————————————————————————————————————

const MONDES = ${JSON.stringify(MONDES)}

const listes = document.getElementById('listes')
const elTitre = document.getElementById('titre')
const elFiche = document.getElementById('fiche')
const elBascule = document.getElementById('bascule')
const elTransport = document.getElementById('transport')
const toile = document.getElementById('rouleau')

const NOMS_VOIX = ['basse', 'nappe', 'accords', 'arpege', 'chant', 'grosse', 'caisse', 'charley']
const TEINTES = {
  basse: '#5ddb8a', nappe: '#b98cff', accords: '#49d3cf', arpege: '#ffb43c',
  chant: '#d6e0d9', grosse: '#ff5f56', caisse: '#5d6f66', charley: '#27332e',
}

function bloc(titre, note, fiches, rang) {
  const lignes = fiches
    .map(
      (f) => \`<tr data-id="\${f.id}">
        <td class="cmd"><button class="piste" data-id="\${f.id}" aria-label="Écouter \${f.nom}">▶</button></td>
        <td class="nom">\${f.nom}</td>
        <td class="id">\${f.id}</td>
        <td class="n">\${f.bpm}</td>
        <td class="trait">\${f.gamme}</td>
        <td class="trait">\${nomTonique(f.tonique)}</td>
        <td class="trait">\${f.ambiance}</td>
      </tr>\`,
    )
    .join('')
  return \`<section>
    <div class="barre">
      \${rang ? \`<span class="rang">\${rang}</span>\` : ''}
      <h2>\${titre}</h2><span class="note">\${note}</span>
    </div>
    <div class="tableau"><table>
      <thead><tr>
        <th></th><th>morceau</th><th>clé</th><th class="n">bpm</th>
        <th class="trait">gamme</th><th class="trait">ton</th><th class="trait">ambiance</th>
      </tr></thead>
      <tbody>\${lignes}</tbody>
    </table></div>
  </section>\`
}

listes.innerHTML =
  MONDES.map((m, i) => bloc(m[0], m[1], BRECHE.slice(i * 5, i * 5 + 5), String(i + 1).padStart(2, '0'))).join('') +
  bloc('LE RESTE DE LA BORNE', 'une bande par jeu', JEUX, '')

// — Le son ————————————————————————————————————————————————

let ctx = null
const joueur = new Joueur()
let courante = null

function prete() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    const maitre = ctx.createGain()
    maitre.gain.value = 0.42
    maitre.connect(ctx.destination)
    joueur.branche(ctx, maitre)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

function joue(fiche) {
  prete()
  if (courante?.id === fiche.id && joueur.enCours) return arrete()
  joueur.arrete(0.08)
  courante = fiche
  joueur.joue(fiche)
  peint()
}

function arrete() {
  joueur.arrete(0.25)
  courante = null
  peint()
}

function peint() {
  const y = courante
  elTransport.classList.toggle('actif', !!y)
  elBascule.textContent = y ? '■' : '▶'
  elBascule.setAttribute('aria-label', y ? 'Arrêt' : 'Lecture')
  elTitre.textContent = y ? y.nom : 'rien ne joue'
  elTitre.classList.toggle('rien', !y)
  elFiche.textContent = y
    ? \`\${y.bpm} bpm · \${y.gamme} · \${nomTonique(y.tonique)} · \${y.ambiance} · graine \${y.graine.toString(16)}\`
    : 'choisis une bande dans la liste'
  for (const tr of listes.querySelectorAll('tr[data-id]')) {
    const sien = tr.dataset.id === y?.id
    tr.classList.toggle('joue', sien)
    const b = tr.querySelector('button.piste')
    if (b) b.textContent = sien ? '■' : '▶'
  }
}

listes.addEventListener('click', (e) => {
  const b = e.target.closest('button.piste')
  if (b) joue(PAR_ID[b.dataset.id])
})
elBascule.addEventListener('click', () => (courante ? arrete() : joue(BRECHE[0])))

// — Le rouleau ——————————————————————————————————————————————
//
// Une lane par voix, six secondes de fenêtre, le présent sur une ligne fixe
// aux deux tiers : ce qui vient est à droite, ce qui sonne est allumé. On
// dessine sur la grille de 2 px de la maison, sans lissage — un rouleau lisse
// dans une borne en gros pixels jurerait.

const g = toile.getContext('2d')
const FENETRE = 6
const PRESENT = 0.66

/**
 * L'étendue de chaque voix sur le morceau entier. Sans elle, un arpège se
 * dessinerait comme une barre continue : les notes se suivent sans blanc, et
 * c'est justement leur *hauteur* qui fait l'arpège. On place donc chaque note
 * dans sa lane selon son rang — la mélodie se voit, pas seulement le rythme.
 */
const etendues = new Map()
function etendue(piste) {
  if (etendues.has(piste.id)) return etendues.get(piste.id)
  const par = {}
  for (const e of piste.evenements) {
    if (NOMS_VOIX.indexOf(e.voix) >= 5) continue
    const v = (par[e.voix] ??= { bas: Infinity, haut: -Infinity })
    v.bas = Math.min(v.bas, e.note)
    v.haut = Math.max(v.haut, e.note)
  }
  etendues.set(piste.id, par)
  return par
}

function rouleau() {
  requestAnimationFrame(rouleau)
  const L = toile.width
  const H = toile.height
  g.fillStyle = '#0b0e0d'
  g.fillRect(0, 0, L, H)

  const lanes = NOMS_VOIX.length
  const haut = Math.floor(H / lanes / 2) * 2

  g.fillStyle = '#141a18'
  for (let i = 0; i < lanes; i += 2) g.fillRect(0, i * haut, L, haut)

  if (!courante || !joueur.piste) {
    g.fillStyle = '#27332e'
    g.font = '700 20px ui-monospace, monospace'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('— PARTITION —', L / 2, H / 2)
    return
  }

  // Où en est la bande : le joueur décale son origine à chaque boucle, donc
  // le reste de la division donne la position dans le morceau.
  const piste = joueur.piste
  const brut = ctx.currentTime - joueur.debut
  const t = ((brut % piste.duree) + piste.duree) % piste.duree
  const x0 = L * PRESENT
  const parSeconde = L / FENETRE

  for (const e of piste.evenements) {
    // Les évènements du tour suivant, ramenés devant, pour que la boucle ne
    // laisse pas un blanc de six secondes à chaque fin de morceau.
    for (const decalage of [0, piste.duree]) {
      const dt = e.t + decalage - t
      const x = Math.round((x0 + dt * parSeconde) / 2) * 2
      if (x < -40 || x > L + 40) continue
      const lane = NOMS_VOIX.indexOf(e.voix)
      if (lane < 0) continue
      const perc = lane >= 5
      // Deux pixels de moins que la durée réelle : un arpège est legato, ses
      // notes se touchent, et sans ce jour on ne voit qu'une barre.
      const larg = Math.max(2, Math.round(((perc ? 0.06 : e.duree) * parSeconde) / 2) * 2 - 2)
      let y = lane * haut + 2
      let h = haut - 4
      if (!perc) {
        const v = etendue(piste)[e.voix]
        const course = Math.max(1, v.haut - v.bas)
        h = Math.max(4, Math.round((haut - 4) / 3 / 2) * 2)
        y += Math.round((((v.haut - e.note) / course) * (haut - 4 - h)) / 2) * 2
      }
      const sonne = dt <= 0 && dt + (perc ? 0.12 : e.duree) > 0

      if (sonne) {
        g.globalAlpha = 0.22
        g.fillStyle = TEINTES[e.voix]
        g.fillRect(x - 4, y - 4, larg + 8, h + 8)
        g.globalAlpha = 1
      }
      g.fillStyle = TEINTES[e.voix]
      g.globalAlpha = dt > 0 ? 0.5 : sonne ? 1 : 0.28
      g.fillRect(x, y, larg, h)
      g.globalAlpha = 1
    }
  }

  g.fillStyle = '#ffb43c'
  g.fillRect(x0, 0, 2, H)
}
rouleau()
</script>
`

writeFileSync(SORTIE, page)
const ko = (page.length / 1024).toFixed(0)
console.log(`console d'écoute : ${SORTIE} (${ko} ko, ${MUSIQUE.length} octets de musique recopiés)`)
