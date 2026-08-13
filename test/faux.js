/**
 * Le banc d'essai : un canvas qui n'existe pas et un moteur qui ne dessine pas.
 *
 * Les jeux d'ARKAD ne dépendent du navigateur que par le contexte 2D et par le
 * contexte de partie que le moteur leur passe. Les deux tiennent en une
 * centaine de lignes de faux, et ça suffit à jouer une partie entière sous
 * `node --test` : pas de navigateur, pas de dépendance, pas d'attente.
 */

export const W = 360
export const H = 640
export const HUD = 56

/** Les deux gabarits, pour éprouver un jeu dans les deux sens. */
export const FORMATS = { portrait: { W: 360, H: 640 }, paysage: { W: 640, H: 360 } }

/**
 * `bandeTramee` rend son tramage une fois dans une toile de côté. C'est le seul
 * endroit de la boîte à dessin qui touche au DOM ; un `document` de six lignes
 * suffit à le satisfaire, et évite d'avoir à charger un navigateur pour un
 * dégradé en points.
 */
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({ fillStyle: '', fillRect() {} }),
    }),
  }
}

/**
 * Un contexte 2D qui enregistre au lieu de peindre. Les coordonnées sont
 * rendues absolues (les translations sont appliquées), donc une assertion sur
 * une position est une assertion sur ce que le joueur voit.
 */
export function fauxCtx() {
  let dx = 0
  let dy = 0
  const pile = []
  const ops = []

  return {
    ops,
    fillStyle: '#000',
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1,
    letterSpacing: '0px',

    save() {
      pile.push([dx, dy, this.globalAlpha])
    },
    restore() {
      const p = pile.pop()
      if (p) [dx, dy, this.globalAlpha] = p
    },
    translate(x, y) {
      dx += x
      dy += y
    },
    scale() {},
    setTransform() {},
    measureText(s) {
      // Approximation monospace, suffisante : on ne teste pas la typo, on
      // teste que rien ne déborde. La police s'écrit « 700 11px … » — un
      // `parseFloat` naïf y lisait la graisse, donc onze pixels de texte en
      // mesuraient sept cents, et toute mesure de largeur était fausse.
      const taille = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '') || 12
      return { width: String(s).length * taille * 0.6 }
    },
    fillRect(x, y, w, h) {
      ops.push({ type: 'rect', x: x + dx, y: y + dy, w, h, couleur: this.fillStyle, alpha: this.globalAlpha })
    },
    fillText(s, x, y) {
      ops.push({ type: 'texte', s: String(s), x: x + dx, y: y + dy, couleur: this.fillStyle, alpha: this.globalAlpha })
    },
    drawImage(_img, x = 0, y = 0, w = 0, h = 0) {
      ops.push({ type: 'image', x: x + dx, y: y + dy, w, h })
    },
  }
}

/** Une source de hasard reproductible : un test qui échoue doit réechouer. */
export function graine(n = 1) {
  let a = n >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RIEN = new Proxy(() => RIEN, { get: () => RIEN, apply: () => RIEN })

/**
 * Le contexte de partie, copie fidèle de celui que construit `engine.js` —
 * sons et effets muets, stockage en mémoire.
 */
export function fauxJeu(def, options = {}) {
  const hasard = options.hasard ?? graine(options.graine ?? 1)
  const memoire = options.memoire ?? { valeur: null }
  // Un jeu peut être éprouvé dans les deux gabarits : `format: 'paysage'` lui
  // donne 640 × 360, exactement comme le moteur le ferait sur un téléphone
  // couché.
  const taille = FORMATS[options.format] ?? FORMATS.portrait

  const j = {
    W: taille.W,
    H: taille.H,
    paysage: taille.W > taille.H,
    HUD,
    t: 0,
    score: 0,
    vies: def.vies ?? 1,
    meilleur: 0,
    pointer: { x: taille.W / 2, y: taille.H / 2 },
    son: RIEN,
    fx: RIEN,
    musique: () => {},
    maintenu: false,
    e: {},
    hasard,
    entier: (a, b) => a + Math.floor(hasard() * (b - a)),
    sauve(donnees) {
      memoire.valeur = JSON.stringify(donnees)
    },
    charge() {
      try {
        return JSON.parse(memoire.valeur ?? 'null')
      } catch {
        return null
      }
    },
    efface() {
      memoire.valeur = null
    },
    fini: false,
    perdu() {
      this.fini = true
    },
  }

  if (options.neuve) j.efface()
  def.init?.(j)
  return j
}

/** Le pas de temps du banc : 60 images par seconde, comme à l'écran. */
export const PAS = 1 / 60

/**
 * Fait tourner une partie. `pilote(j, temps)` est appelé avant chaque image et
 * peut renvoyer `'appui'`, `'relache'` ou rien. On s'arrête à la mort ou au
 * bout de `duree` secondes.
 */
export function joue(def, { duree = 30, pilote, dessine = false, ...options } = {}) {
  const j = fauxJeu(def, options)
  const ctx = dessine ? fauxCtx() : null
  let images = 0

  while (j.t < duree && !j.fini) {
    const geste = pilote?.(j, j.t)
    if (geste === 'appui') def.appui?.(j, j.pointer)
    else if (geste === 'relache') def.relache?.(j, j.pointer)

    def.maj?.(j, PAS)
    if (ctx) {
      ctx.ops.length = 0
      def.dessine?.(j, ctx)
    }
    j.t += PAS
    images++
  }

  return { j, ctx, images, mort: j.fini, duree: j.t }
}
