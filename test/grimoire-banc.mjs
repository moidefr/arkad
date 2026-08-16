/**
 * Le banc d'équilibrage de GRIMOIRE.
 *
 * Contrairement à `usine-banc.mjs` (une seule longue partie qu'on regarde
 * avancer), et un peu comme `expedition-banc.mjs`, GRIMOIRE se rejoue en
 * Monte-Carlo — mais avec un `meta` partagé d'une partie à l'autre, comme un
 * vrai joueur qui enchaîne les parties : c'est la seule façon de voir si la
 * méta-progression (les cartes débloquées par les victoires à vie) fait
 * vraiment progresser les parties suivantes, plutôt que de le supposer.
 *
 * Trois automates (brutal / synergie / équilibré) jouent chacun `n` parties
 * d'affilée, sur le même `meta`. Le banc imprime la profondeur médiane, la
 * progression entre les dix premières et les dix dernières parties, la taille
 * du deck à la mort, et la cause de mort dominante.
 *
 *   node test/grimoire-banc.mjs [parties]
 */
import { POOL, STARTERS } from '../src/long/grimoire/donnees.js'
import * as L from '../src/long/grimoire/logique.js'
import { graine } from './faux.js'

const PARTIES = Number(process.argv[2] ?? 200)

// --- Les automates ---------------------------------------------------------------
//
// `brutal` chasse le plus gros chiffre, sans plan : le piège classique du
// genre. `synergie` construit un contrôle (poison, vulnérabilité, force) et
// n'accepte une carte qu'à condition qu'elle serve ce plan — un deck plus
// petit mais plus sûr. `equilibre` n'a pas de doctrine, juste un mélange
// des deux, pour vérifier qu'aucune des deux extrémités n'est écrasante.

function scoreBrutal(carte, co) {
  if (carte.type === 'attaque') return 100 + (carte.degats ?? 0) * (carte.fois ?? 1) * 10
  if (carte.type === 'defense') return 20 + (carte.bloc ?? 0)
  return 10 + (carte.soin ?? 0) + (carte.energieBonus ?? 0) * 5
}

function scoreSynergie(carte, co) {
  let s = (carte.degats ?? 0) * (carte.fois ?? 1) * 0.6
  s += (carte.poison ?? 0) * 3 + (carte.vulnerable ?? 0) * 4 + (carte.faible ?? 0) * 4
  s += (carte.force ?? 0) * 3.5 + (carte.bloc ?? 0) * 1.6 + (carte.soin ?? 0) * 1.4
  s += (carte.comboParCarte ?? 0) * 5 + (carte.pioche ?? 0) * 2
  if (carte.finisseur) s += co.pv <= co.pvMax * 0.3 ? 20 : 3
  s -= (carte.recul ?? 0) * 3 + (carte.fragile ?? 0) * 4
  return s
}

function scoreEquilibre(carte, co) {
  return (scoreBrutal(carte, co) + scoreSynergie(carte, co)) / 2
}

const BOTS = {
  brutal: { jouer: scoreBrutal, recompense: scoreBrutal },
  synergie: { jouer: scoreSynergie, recompense: scoreSynergie },
  equilibre: { jouer: scoreEquilibre, recompense: scoreEquilibre },
}

/** Joue un tour entier : la meilleure carte jouable, encore et encore, tant
 * que l'énergie le permet ; termine le tour dès qu'il n'y a plus de bon choix. */
function joueTour(bot, s, hasard) {
  const run = s.run
  for (let garde = 0; garde < 20; garde++) {
    const main = L.mainDe(run)
    let meilleur = -1
    let meilleurScore = -Infinity
    main.forEach((carte, i) => {
      if (!L.estJouable(run, carte)) return
      const score = bot.jouer(carte, run.combat)
      if (score > meilleurScore) {
        meilleurScore = score
        meilleur = i
      }
    })
    if (meilleur < 0) break
    const ev = L.jouerCarte(s, meilleur, hasard)
    if (ev.victoire || ev.defaite) return ev
  }
  return L.finirTour(s, hasard)
}

/** Choisit la meilleure carte offerte, ou passe si aucune ne vaut mieux
 * qu'une main vide — la seule façon pour `synergie` de garder un deck lean. */
function choisitRecompense(bot, s, hasard) {
  const run = s.run
  const co = { pv: run.pvMax, pvMax: run.pvMax } // hors combat : pas de bonus « finisseur »
  let meilleur = null
  let meilleurScore = bot === BOTS.synergie ? 4 : 0 // synergie exige une vraie utilité pour grossir le deck
  for (const id of run.recompense) {
    const carte = L.carteDe(id)
    const score = bot.recompense(carte, co)
    if (score > meilleurScore) {
      meilleurScore = score
      meilleur = id
    }
  }
  return L.choisirRecompense(s, meilleur, hasard)
}

/** Une partie entière, du deck de départ à la défaite. */
function joueUnePartie(bot, s, hasard) {
  let causeMort = ''
  for (let tour = 0; tour < 4000; tour++) {
    if (s.run.phase === 'recompense') {
      choisitRecompense(bot, s, hasard)
      continue
    }
    const co = s.run.combat
    const ev = joueTour(bot, s, hasard)
    if (ev.subis) causeMort = `${co.nom}`
    if (ev.defaite) return { profondeur: ev.profondeur, deck: L.tailleDeck(s.run), cause: causeMort || 'inconnue' }
  }
  return { profondeur: s.run.profondeur, deck: L.tailleDeck(s.run), cause: 'bloqué à 4000 tours' }
}

function mediane(xs) {
  const t = [...xs].sort((a, b) => a - b)
  return t[Math.floor(t.length / 2)] ?? 0
}
function moyenne(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

console.log(`${PARTIES} parties d’affilée par automate (méta partagée, comme un vrai joueur)\n`)
console.log(`pool : ${STARTERS.length} cartes de départ, ${POOL.length} cartes à débloquer\n`)

for (const [nom, bot] of Object.entries(BOTS)) {
  const hasard = graine(nom.length * 7919 + 3)
  const s = L.neuf()
  const profondeurs = []
  const decks = []
  const causes = {}

  for (let i = 0; i < PARTIES; i++) {
    L.demarrer(s, hasard)
    const r = joueUnePartie(bot, s, hasard)
    profondeurs.push(r.profondeur)
    decks.push(r.deck)
    causes[r.cause] = (causes[r.cause] ?? 0) + 1
  }

  const dix = Math.max(1, Math.floor(PARTIES / 10))
  const debut = moyenne(profondeurs.slice(0, dix))
  const fin = moyenne(profondeurs.slice(-dix))
  const causePrincipale = Object.entries(causes).sort((a, b) => b[1] - a[1])[0]

  console.log(
    `  ${nom.padEnd(10)} profondeur médiane ${String(mediane(profondeurs)).padStart(3)} · ` +
      `10 premières parties ${debut.toFixed(1).padStart(5)} → 10 dernières ${fin.toFixed(1).padStart(5)} ` +
      `(${fin >= debut ? '+' : ''}${(fin - debut).toFixed(1)}) · ` +
      `deck moyen à la mort ${moyenne(decks).toFixed(1).padStart(5)} cartes · ` +
      `méta finale ${s.meta.victoires} victoires à vie`,
  )
  console.log(`             cause de mort dominante : ${causePrincipale[0]} (${causePrincipale[1]}/${PARTIES})`)
}

console.log('\n  paliers de déblocage —')
const paliers = {}
for (const c of POOL) paliers[c.debloqueA] = (paliers[c.debloqueA] ?? 0) + 1
for (const [seuil, n] of Object.entries(paliers).sort((a, b) => a[0] - b[0])) {
  console.log(`    ${seuil.padStart(2)} victoires à vie → +${n} carte(s) au pool`)
}
