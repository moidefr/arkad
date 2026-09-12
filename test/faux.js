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
 *
 * Il tient trois choses de plus que ce qu'un `fillText` rend visible, et les
 * trois servent à prouver l'accord entre ce qu'on voit et ce qu'on touche :
 * l'étendue horizontale d'un texte (`gauche`, `larg`), calée sur son
 * alignement, sans quoi deux lignes superposées passent inaperçues ; sa taille,
 * pour en déduire la bande qu'il occupe ; et le découpage en cours (`coupe`),
 * sans quoi une carte peinte hors de sa fenêtre compte comme visible.
 */
export function fauxCtx() {
  let dx = 0
  let dy = 0
  let coupe = null
  let chemin = null
  const pile = []
  const ops = []

  return {
    ops,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: 'center',
    textBaseline: 'middle',
    globalAlpha: 1,
    letterSpacing: '0px',

    save() {
      pile.push([dx, dy, this.globalAlpha, coupe])
    },
    restore() {
      const p = pile.pop()
      if (p) [dx, dy, this.globalAlpha, coupe] = p
    },
    translate(x, y) {
      dx += x
      dy += y
    },
    scale() {},
    setTransform() {},
    /**
     * La rotation est enregistrée mais **pas appliquée** aux coordonnées.
     *
     * C'est un choix, pas un oubli : les tests d'écran vérifient que rien ne
     * sort du cadre ni ne passe sous le bandeau, et le seul objet tourné de la
     * borne est le cube de RUÉE, large de 22 px et jamais près d'un bord. Faire
     * tourner pour de vrai demanderait une matrice complète pour rendre des
     * bornes 3 px plus larges sur un objet, ce que personne ne teste.
     */
    rotate(a) {
      this.angle = a
    },
    beginPath() {
      chemin = null
    },
    rect(x, y, w, h) {
      chemin = { x: x + dx, y: y + dy, w, h }
    },
    // Le thème moderne peint par chemin plutôt que par `fillRect`. On rend la
    // même op des deux côtés : c'est ce qui permet de comparer la disposition
    // d'un thème à l'autre sans que la comparaison porte sur la manière de
    // peindre.
    roundRect(x, y, w, h, r) {
      chemin = { x: x + dx, y: y + dy, w, h, r }
    },
    arc(cx, cy, r) {
      chemin = { x: cx + dx - r, y: cy + dy - r, w: r * 2, h: r * 2, disque: true }
    },
    fill() {
      if (chemin) ops.push({ type: 'rect', ...chemin, couleur: this.fillStyle, alpha: this.globalAlpha, coupe })
    },
    stroke() {
      // Un trait est centré sur son chemin : il déborde de la moitié de sa
      // largeur de chaque côté. Enregistrer le chemin nu ferait croire qu'un
      // cadre tracé occupe moins de place qu'un cadre posé en quatre bandes,
      // alors qu'à l'écran les deux couvrent exactement le même rectangle.
      if (!chemin) return
      const d = (this.lineWidth ?? 1) / 2
      ops.push({
        type: 'trait',
        ...chemin,
        x: chemin.x - d,
        y: chemin.y - d,
        w: chemin.w + d * 2,
        h: chemin.h + d * 2,
        couleur: this.strokeStyle,
        alpha: this.globalAlpha,
        coupe,
      })
    },
    createLinearGradient() {
      // Un dégradé n'a pas de position à tester : on retient sa dernière
      // couleur pour que `fillStyle` reste une chaîne comparable.
      let derniere = '#000'
      return { addColorStop: (_p, c) => (derniere = c), toString: () => derniere }
    },
    clip() {
      if (chemin) coupe = coupe ? croise(coupe, chemin) : chemin
    },
    measureText(s) {
      // Approximation monospace, suffisante : on ne teste pas la typo, on
      // teste que rien ne déborde. La police s'écrit « 700 11px … » — un
      // `parseFloat` naïf y lisait la graisse, donc onze pixels de texte en
      // mesuraient sept cents, et toute mesure de largeur était fausse.
      const taille = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '') || 12
      return { width: String(s).length * taille * 0.6 }
    },
    fillRect(x, y, w, h) {
      ops.push({ type: 'rect', x: x + dx, y: y + dy, w, h, couleur: this.fillStyle, alpha: this.globalAlpha, coupe })
    },
    fillText(s, x, y, max) {
      const t = String(s)
      const taille = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '') || 12
      // `fillText` condense au lieu de couper : une largeur maximale borne
      // l'étendue, elle ne retire aucune lettre.
      const larg = Math.min(t.length * taille * 0.6, max ?? Infinity)
      const bord = this.textAlign === 'right' ? larg : this.textAlign === 'center' ? larg / 2 : 0
      ops.push({
        type: 'texte',
        s: t,
        x: x + dx,
        y: y + dy,
        gauche: x + dx - bord,
        larg,
        taille,
        couleur: this.fillStyle,
        alpha: this.globalAlpha,
        coupe,
      })
    },
    drawImage(_img, x = 0, y = 0, w = 0, h = 0) {
      ops.push({ type: 'image', x: x + dx, y: y + dy, w, h, coupe })
    },
  }
}

const croise = (a, b) => {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  return { x, y, w: Math.min(a.x + a.w, b.x + b.w) - x, h: Math.min(a.y + a.h, b.y + b.h) - y }
}

/**
 * Le rectangle qu'une op laisse réellement à l'écran, découpage compris —
 * `null` si elle ne laisse rien. Un texte occupe la bande de sa taille autour
 * de sa ligne de base, le moteur écrivant en `textBaseline: 'middle'`.
 */
export function peint(o) {
  const b =
    o.type === 'texte'
      ? { x: o.gauche, y: o.y - o.taille * 0.55, w: o.larg, h: o.taille * 1.1 }
      : { x: o.x, y: o.y, w: o.w, h: o.h }
  const r = o.coupe ? croise(b, o.coupe) : b
  return r.w > 0 && r.h > 0 && o.alpha !== 0 ? r : null
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
    /**
     * Le doigt est-il posé ?
     *
     * Le moteur en fait un accesseur branché sur l'entrée réelle ; ici c'est
     * `joue()` qui le tient à jour au rythme du pilote. Il valait `false`
     * pour toujours, ce qui rendait **huit jeux intestables** : VOLTIGE,
     * FUSÉE, TRACÉ, VISÉE et DÉDALE se jouent au doigt maintenu, DÉMINEUR,
     * FLUX et PICROSS s'en servent pour leur appui long. Les tests les
     * faisaient tourner sans jamais leur donner la seule chose qu'ils
     * attendent.
     */
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
    // `maintenu` suit le pilote, comme il suivrait le doigt : un « appui »
    // pose le doigt, un « relâche » le lève, et rien ne le bouge entre les
    // deux. Sans ça, un jeu qui se joue en maintenant ne voit jamais rien.
    if (geste === 'appui') {
      j.maintenu = true
      def.appui?.(j, j.pointer)
    } else if (geste === 'relache') {
      j.maintenu = false
      def.relache?.(j, j.pointer)
    }

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
