/**
 * Le compositeur : une fiche de quelques champs, une bande-son entière.
 *
 * **Aucun son ici.** `compose()` est une fonction pure qui rend une liste
 * d'évènements — quand, quelle voix, quelle note, combien de temps. Le joueur
 * (`joueur.js`) se contente de les programmer dans le contexte audio. C'est
 * cette séparation qui permet de vérifier sous `node --test` qu'aucune des
 * cinquante bandes n'est muette, qu'aucune ne joue de fausse note, et qu'il
 * n'y en a pas deux identiques — sans jamais ouvrir un navigateur.
 *
 * Pourquoi générer plutôt que jouer des fichiers : cinquante morceaux enregistrés
 * pèseraient une centaine de mégaoctets dans une application qui en fait moins
 * d'un, et il faudrait les télécharger. Générés, ils tiennent en **huit champs
 * chacun** — le reste sort de la graine, et sort toujours pareil.
 */
import { melange32 } from '../hasard.js'

// --- La matière ------------------------------------------------------------------

/** Les gammes, en demi-tons depuis la tonique. Une gamme, une couleur. */
export const GAMMES = {
  mineur: [0, 2, 3, 5, 7, 8, 10],
  dorien: [0, 2, 3, 5, 7, 9, 10],
  phrygien: [0, 1, 3, 5, 7, 8, 10],
  majeur: [0, 2, 4, 5, 7, 9, 11],
  lydien: [0, 2, 4, 6, 7, 9, 11],
  mixolydien: [0, 2, 4, 5, 7, 9, 10],
  penta: [0, 3, 5, 7, 10],
  pentaMaj: [0, 2, 4, 7, 9],
  harmonique: [0, 2, 3, 5, 7, 8, 11],
  japonais: [0, 1, 5, 7, 8],
}

/**
 * Les enchaînements d'accords, en degrés. Ce sont eux qui donnent son
 * caractère à un morceau : on ne tire pas les accords au hasard, on tire
 * **lequel de ces enchaînements** on suit, puis tout le reste s'y accroche.
 */
export const MARCHES = [
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [0, 4, 5, 3],
  [0, 6, 5, 4],
  [0, 2, 3, 4],
  [0, 5, 1, 4],
  [0, 0, 3, 4],
  [0, 3, 0, 4],
  [0, 4, 3, 5],
  [5, 3, 0, 4],
]

/**
 * Les ambiances. Elles ne choisissent pas les notes — elles choisissent
 * **qui joue et à quelle densité**, ce qui suffit à ce qu'une même marche
 * d'accords sonne comme une veillée ou comme une poursuite.
 */
export const AMBIANCES = {
  calme: { voix: ['basse', 'nappe', 'chant'], densite: 0.3, percu: 'aucune', octave: 0, souffle: 1.4 },
  veille: { voix: ['basse', 'nappe', 'chant'], densite: 0.4, percu: 'douce', octave: 0, souffle: 1.2 },
  marche: { voix: ['basse', 'accords', 'chant'], densite: 0.55, percu: 'nette', octave: 0, souffle: 0.7 },
  tendu: { voix: ['basse', 'accords', 'chant'], densite: 0.7, percu: 'nette', octave: 0, souffle: 0.5 },
  course: { voix: ['basse', 'arpege', 'chant'], densite: 0.85, percu: 'serree', octave: 12, souffle: 0.35 },
  martial: { voix: ['basse', 'accords'], densite: 0.6, percu: 'martiale', octave: -12, souffle: 0.6 },
  mecanique: { voix: ['basse', 'arpege'], densite: 0.75, percu: 'serree', octave: 0, souffle: 0.4 },
  nocturne: { voix: ['basse', 'nappe', 'arpege'], densite: 0.45, percu: 'douce', octave: 12, souffle: 1.6 },
  glace: { voix: ['nappe', 'arpege', 'chant'], densite: 0.4, percu: 'aucune', octave: 12, souffle: 2 },
  brasier: { voix: ['basse', 'accords', 'arpege'], densite: 0.9, percu: 'martiale', octave: -12, souffle: 0.4 },
  vide: { voix: ['nappe', 'chant'], densite: 0.25, percu: 'aucune', octave: 12, souffle: 2.4 },
  fete: { voix: ['basse', 'accords', 'chant'], densite: 0.8, percu: 'serree', octave: 0, souffle: 0.5 },
}

/** Les motifs de percussion, sur seize doubles-croches. `g` grosse, `c` caisse, `x` charley. */
export const PERCUS = {
  aucune: [],
  douce: ['g...............', '........c.......', '..x...x...x...x.'],
  nette: ['g.......g.......', '....c.......c...', 'x.x.x.x.x.x.x.x.'],
  serree: ['g...g...g...g...', '....c.......c...', 'xxxxxxxxxxxxxxxx'],
  martiale: ['g...g.g.g...g...', '....c...c...c...', 'x.x.x.x.x.x.xxx.'],
}

export const VOIX = ['basse', 'nappe', 'accords', 'arpege', 'chant', 'grosse', 'caisse', 'charley']

const NOTES = ['DO', 'DO#', 'RÉ', 'MI♭', 'MI', 'FA', 'FA#', 'SOL', 'LA♭', 'LA', 'SI♭', 'SI']
export const nomTonique = (t) => NOTES[((t % 12) + 12) % 12]

/** Le degré `d` de la gamme, en demi-tons, octaves comprises. */
export function degre(gamme, d) {
  const n = gamme.length
  const octave = Math.floor(d / n)
  return gamme[((d % n) + n) % n] + octave * 12
}

/** Un accord de trois sons bâti sur un degré : la tierce et la quinte de la gamme. */
export const accord = (gamme, d) => [degre(gamme, d), degre(gamme, d + 2), degre(gamme, d + 4)]

// --- La composition ---------------------------------------------------------------

export const MESURES_PAR_PARTIE = 4
export const PARTIES = 4
export const TEMPS_PAR_MESURE = 4
export const TEMPS_PAR_PARTIE = MESURES_PAR_PARTIE * TEMPS_PAR_MESURE

/**
 * Compose la bande entière : seize mesures, quatre parties de quatre.
 *
 * La forme est A A' B A'' : la troisième partie change de registre et de
 * densité, les autres varient sans se contredire. C'est le strict minimum
 * pour qu'une boucle de deux minutes ne se dénonce pas au bout de trente
 * secondes — et c'est aussi peu que possible, parce que tout ce qui n'est pas
 * la forme doit venir de la graine.
 */
export function compose(fiche) {
  const rng = melange32(fiche.graine >>> 0)
  const gamme = GAMMES[fiche.gamme] ?? GAMMES.mineur
  const amb = AMBIANCES[fiche.ambiance] ?? AMBIANCES.marche
  const marche = MARCHES[Math.floor(rng() * MARCHES.length)]
  const tonique = 48 + (fiche.tonique ?? 0)
  const evenements = []
  const parTemps = 60 / fiche.bpm

  // Le motif de chant : une phrase de huit degrés, tirée une fois et reprise
  // avec des variantes. Une mélodie retirée à chaque mesure n'est pas une
  // mélodie, c'est du bruit ordonné.
  const phrase = Array.from({ length: 8 }, () => Math.floor(rng() * 7) - 2)
  const rythme = Array.from({ length: 8 }, () => (rng() < 0.72 ? 1 : 0))

  for (let partie = 0; partie < PARTIES; partie++) {
    const pont = partie === 2
    const densite = Math.min(1, amb.densite * (pont ? 0.75 : 1) + partie * 0.05)
    for (let mesure = 0; mesure < MESURES_PAR_PARTIE; mesure++) {
      const t0 = (partie * TEMPS_PAR_PARTIE + mesure * TEMPS_PAR_MESURE) * parTemps
      const d = marche[(mesure + (pont ? 2 : 0)) % marche.length]
      const acc = accord(gamme, d).map((x) => x + tonique)

      // La basse ne monte jamais : l'octave d'ambiance ne sert qu'à éclaircir
      // le haut du morceau, pas à lui retirer son socle.
      if (amb.voix.includes('basse')) basse(evenements, t0, parTemps, acc, -12 + Math.min(0, amb.octave), densite, rng)
      if (amb.voix.includes('nappe')) nappe(evenements, t0, parTemps, acc, amb.souffle)
      if (amb.voix.includes('accords')) accords(evenements, t0, parTemps, acc, densite)
      if (amb.voix.includes('arpege')) arpege(evenements, t0, parTemps, acc, densite, amb.octave, rng)
      if (amb.voix.includes('chant') && (!pont || partie === 3)) {
        chant(evenements, t0, parTemps, gamme, tonique + 12 + amb.octave, d, phrase, rythme, mesure, pont)
      }
      percussion(evenements, t0, parTemps, amb.percu, densite)
    }
  }

  evenements.sort((a, b) => a.t - b.t)
  return {
    id: fiche.id,
    nom: fiche.nom,
    bpm: fiche.bpm,
    duree: PARTIES * MESURES_PAR_PARTIE * TEMPS_PAR_MESURE * parTemps,
    evenements,
  }
}

const pose = (out, t, voix, note, duree, volume) => out.push({ t, voix, note, duree, volume })

/**
 * La basse. Sa note de passage est **prise dans l'accord** — la quinte ou la
 * tierce — et non à un intervalle fixe : à sept demi-tons au-dessus d'un degré
 * quelconque, on sort de la gamme une fois sur deux, et ça s'entend.
 */
function basse(out, t0, pt, acc, decalage, densite, rng) {
  const note = acc[0] + decalage
  pose(out, t0, 'basse', note, pt * 0.9, 0.5)
  pose(out, t0 + pt * 2, 'basse', note, pt * 0.9, 0.42)
  if (densite > 0.5) pose(out, t0 + pt * 3, 'basse', (rng() < 0.5 ? acc[2] : acc[1]) + decalage, pt * 0.5, 0.34)
  if (densite > 0.8) pose(out, t0 + pt * 1.5, 'basse', note, pt * 0.4, 0.3)
}

function nappe(out, t0, pt, acc, souffle) {
  for (const n of acc) pose(out, t0, 'nappe', n, pt * TEMPS_PAR_MESURE * Math.min(1, souffle / 2 + 0.5), 0.16)
}

function accords(out, t0, pt, acc, densite) {
  const coups = densite > 0.7 ? [0, 1, 2, 3] : densite > 0.45 ? [0, 2] : [0]
  for (const k of coups) for (const n of acc) pose(out, t0 + k * pt, 'accords', n, pt * 0.7, 0.13)
}

function arpege(out, t0, pt, acc, densite, octave, rng) {
  const pas = densite > 0.7 ? 8 : 4
  const notes = [...acc, acc[0] + 12]
  for (let i = 0; i < pas; i++) {
    const n = notes[i % notes.length] + (i >= notes.length && rng() < 0.4 ? 12 : 0)
    pose(out, t0 + (i * pt * TEMPS_PAR_MESURE) / pas, 'arpege', n, (pt * TEMPS_PAR_MESURE) / pas, 0.14)
  }
}

function chant(out, t0, pt, gamme, base, d, phrase, rythme, mesure, pont) {
  for (let i = 0; i < 8; i++) {
    if (!rythme[(i + mesure) % 8]) continue
    const deg = phrase[i] + d + (pont ? 2 : 0)
    pose(out, t0 + i * pt * 0.5, 'chant', base + degre(gamme, deg), pt * 0.45, 0.2)
  }
}

function percussion(out, t0, pt, nom, densite) {
  const motifs = PERCUS[nom] ?? []
  const voix = ['grosse', 'caisse', 'charley']
  motifs.forEach((motif, k) => {
    for (let i = 0; i < motif.length; i++) {
      if (motif[i] === '.') continue
      if (k === 2 && densite < 0.5 && i % 2) continue
      pose(
        out,
        t0 + (i * pt * TEMPS_PAR_MESURE) / motif.length,
        voix[k],
        0,
        pt * 0.2,
        k === 0 ? 0.5 : k === 1 ? 0.34 : 0.14,
      )
    }
  })
}

/** La fréquence d'une note MIDI. Le seul endroit du fichier qui parle en hertz. */
export const frequence = (note) => 440 * Math.pow(2, (note - 69) / 12)
