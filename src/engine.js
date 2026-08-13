/**
 * Le moteur de la borne.
 *
 * Il tient l'accueil, les catégories, la pause, l'écran de fin et les
 * records — et rien d'autre : il ne sait pas ce que font les jeux. Un jeu lui
 * prête une fonction de mise à jour, une fonction de dessin, et lui dit quand
 * c'est perdu.
 *
 * Les jeux longs, eux, ne se « perdent » pas : ils écrivent leur état avec
 * `j.sauve()` et le relisent au lancement. C'est ce qui permet une partie de
 * dix heures étalée sur trois semaines.
 *
 * **Deux formats.** L'espace logique vaut 360 × 640 par défaut, et 640 × 360
 * pour les jeux qui déclarent `paysage: true`. Le moteur ne connaît que ces
 * deux gabarits ; toutes ses mises en page sont calculées à partir de `this.W`
 * et `this.H`, jamais écrites en dur — et **le dessin et le test de clic
 * passent par la même fonction de disposition**, ce qui rend impossible le
 * bouton décalé de huit pixels.
 */
import { CATEGORIES } from './catalogue.js'
import { Input } from './input.js'
import { C, ton } from './palette.js'
import { son } from './son.js'
import { musique, pourJeu } from './musique.js'
import { theme } from './theme.js'
import { Effets } from './effets.js'
import { lis, ecris } from './stockage.js'
import { FORMATS, HUD, orientationAppareil, formatPour, tailleDe, suggestion } from './format.js'
import { texte, rect, cadre, bloc, lueur, ombre, vignette, bandeTramee, scanlines, largeurTexte, PX } from './dessin.js'

/** Le gabarit de référence — celui des tests et des jeux qui n'en changent pas. */
export const W = FORMATS.portrait.W
export const H = FORMATS.portrait.H
export { HUD }

const DECOMPTE_PAS = 0.42
const DECOMPTE = DECOMPTE_PAS * 3
const REPRISE = 0.9

/** La clé qui retient « ne me le propose plus ». */
const CLE_MUET = 'orientation.muette'

// --- Les dispositions ---------------------------------------------------------
//
// Une fonction par écran, appelée à la fois par le dessin et par l'appui. Elles
// ne dépendent que de la largeur et de la hauteur : le même code sert les deux
// formats, et un troisième ne demanderait rien.

const estLarge = (W, H) => W > H

function dispoSon(W) {
  return { x: W - 62, y: 14, w: 44, h: 32 }
}

const BTN_RETOUR = { x: 16, y: 14, w: 74, h: 34 }

/** L'accueil : une carte par catégorie, en colonne ou en deux colonnes. */
function dispoAccueil(W, H) {
  if (!estLarge(W, H)) return { cols: 1, x: 20, y: 96, w: W - 40, h: 88, pasX: 0, pasY: 102 }
  const w = Math.floor((W - 60) / 2)
  return { cols: 2, x: 20, y: 84, w, h: 112, pasX: w + 20, pasY: 124 }
}

const carteAccueil = (i, d) => ({
  x: d.x + (i % d.cols) * d.pasX,
  y: d.y + Math.floor(i / d.cols) * d.pasY,
  w: d.w,
  h: d.h,
})

/** Les tuiles serrées, quand une catégorie a beaucoup de jeux. */
function dispoTuiles(W, H) {
  const w = 74
  const h = 70
  const ecart = 8
  const cols = Math.max(3, Math.floor((W - 40 + ecart) / (w + ecart)))
  const large = cols * w + (cols - 1) * ecart
  return { cols, w, h, ecart, x: Math.round((W - large) / 2), y: estLarge(W, H) ? 100 : 116 }
}

const tuile = (i, d) => ({
  x: d.x + (i % d.cols) * (d.w + d.ecart),
  y: d.y + Math.floor(i / d.cols) * (d.h + d.ecart),
  w: d.w,
  h: d.h,
})

/** Les rangées détaillées, quand une catégorie n'a que deux ou trois jeux. */
function dispoRangees(W, H, n) {
  if (!estLarge(W, H)) return { cols: 1, x: 20, y: 130, w: W - 40, h: 92, ecart: 14 }
  const cols = n > 1 ? 2 : 1
  const w = cols === 2 ? Math.floor((W - 60) / 2) : W - 40
  return { cols, x: 20, y: 104, w, h: 92, ecart: 14 }
}

const rangee = (i, d) => ({
  x: d.x + (i % d.cols) * (d.w + 20),
  y: d.y + Math.floor(i / d.cols) * (d.h + d.ecart),
  w: d.w,
  h: d.h,
})

/**
 * Rangées détaillées ou tuiles serrées ? On ne tranche pas sur un nombre écrit
 * à la main mais sur ce qui **tient** : six rangées débordaient de l'écran en
 * portrait, et aucune catégorie n'en avait six — le jour où l'une en aurait
 * eu, deux jeux auraient été hors de portée sans que rien ne le signale.
 */
export function enRangees(W, H, n) {
  if (n > 6) return false
  const dernier = rangee(n - 1, dispoRangees(W, H, n))
  return dernier.y + dernier.h <= H - 20
}

/** Les menus empilés de la pause et de la fin. */
function dispoMenu(W, H, n) {
  const large = estLarge(W, H)
  const w = Math.min(300, Math.round(W * (large ? 0.5 : 0.722)))
  const h = large ? 42 : 56
  const pas = h + 12
  return { x: Math.round((W - w) / 2), w, h, pas, y: large ? Math.round(H * 0.3) : Math.round(H * 0.39) }
}

const boutonMenu = (i, d) => ({ x: d.x, y: d.y + i * d.pas, w: d.w, h: d.h })

/**
 * Le menu de pause. Une seule liste, lue par le dessin **et** par l'appui :
 * les deux se sont déjà désynchronisés une fois dans ce projet, et c'était un
 * bouton qui ne répondait pas là où on le voyait.
 */
const MENU_PAUSE = ['REPRENDRE', 'RECOMMENCER', 'QUITTER', 'SON', 'IMAGE']

const dans = (p, z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

export class Moteur {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.orientation = orientationAppareil()
    this.format = this.orientation
    const t = tailleDe(this.format)
    this.W = t.W
    this.H = t.H

    this.input = new Input(canvas, this.W, this.H)
    this.input.onPress = (p) => this._appui(p)
    this.input.onRelease = (p) => this._relache(p)

    this.phase = 'accueil' // accueil | categorie | depart | jeu | reprise | pause | fin | tourne
    this.phaseT = 0
    this.cat = null
    this.def = null
    this.j = null
    this.record = false
    // Secondes restantes pendant lesquelles « NOUVELLE PARTIE » est armé.
    this.arme = 0
    /** Le sens qu'on conseille de prendre, ou null si tout va bien.  */
    this.suggere = null
    this.muet = lis(CLE_MUET, '0') === '1'

    addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this._bascullePause()
    })

    this._redim()
    addEventListener('resize', () => this._redim())
    addEventListener('orientationchange', () => this._redim())
  }

  demarre() {
    let prec = performance.now()
    const tick = (now) => {
      const dt = Math.min((now - prec) / 1000, 1 / 20)
      prec = now
      this._maj(dt)
      this._dessine()
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // --- Format et orientation -------------------------------------------------

  /**
   * Recalcule le gabarit. Appelée au démarrage, à chaque rotation, et au
   * lancement d'un jeu. Si le format change en pleine partie, le jeu est
   * prévenu : il lit `j.W` et `j.H` à chaque image, mais certains gardent une
   * mise en page calculée une fois.
   */
  _redim() {
    this.orientation = orientationAppareil()
    const voulu = this.def ? formatPour(this.def, this.orientation) : this.orientation
    const change = voulu !== this.format
    this.format = voulu
    const t = tailleDe(voulu)
    this.W = t.W
    this.H = t.H

    this.input.W = this.W
    this.input.H = this.H
    this.canvas.style.aspectRatio = `${this.W} / ${this.H}`

    // À la densité réelle de l'écran : c'est ce qui rend le texte net. Le côté
    // pixel vient des formes, pas d'une toile basse résolution.
    const dpr = Math.min(devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(this.W * dpr)
    this.canvas.height = Math.round(this.H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'

    // `j.W` et `j.H` sont des accesseurs branchés sur le moteur : ils suivent
    // tout seuls. Seuls les jeux qui gardent une mise en page calculée une
    // fois ont besoin d'être prévenus.
    if (this.j && change) this.def?.redim?.(this.j)
    this._verifieSuggestion()
  }

  /** Décide s'il faut conseiller une rotation, et la met à l'écran. */
  _verifieSuggestion() {
    if (this.muet || !this.def || this.phase === 'accueil' || this.phase === 'categorie') {
      if (this.phase === 'tourne') this.phase = 'jeu'
      this.suggere = null
      return
    }
    const s = suggestion(this.def, this.orientation)
    if (s === this.suggere) return
    this.suggere = s
    if (s && (this.phase === 'jeu' || this.phase === 'depart')) {
      this.phase = 'tourne'
      this.phaseT = 0
    } else if (!s && this.phase === 'tourne') this.phase = 'jeu'
  }

  // --- Records et sauvegardes ----------------------------------------------

  meilleur(id) {
    return Number(lis('record.' + id, 0))
  }

  _enregistre(id, score) {
    if (score <= this.meilleur(id)) return false
    ecris('record.' + id, Math.floor(score))
    return true
  }

  /** Vrai si un jeu long a une partie en cours sur cet appareil. */
  reprise(def) {
    return def.persistant && lis('sauve.' + def.id, 'null') !== 'null'
  }

  // --- Cycle de vie d'une partie -------------------------------------------

  lance(def, options = {}) {
    this.def = def
    this._redim()
    // On recentre le pointeur : sinon un jeu qui suit le doigt démarre là où
    // on a appuyé sur sa tuile, ce qui peut le tuer avant la première image.
    this.input.pointer.x = this.W / 2
    this.input.pointer.y = this.H / 2

    const cle = 'sauve.' + def.id
    const moteur = this
    const j = {
      get W() {
        return moteur.W
      },
      get H() {
        return moteur.H
      },
      HUD,
      t: 0,
      score: 0,
      vies: def.vies ?? 1,
      meilleur: this.meilleur(def.id),
      pointer: this.input.pointer,
      son,
      fx: new Effets(),
      __input: this.input,
      get maintenu() {
        return this.__input.held
      },
      get paysage() {
        return moteur.format === 'paysage'
      },
      /** Change la bande-son. Un jeu à mondes s'en sert à chaque palier. */
      musique: (quoi) => musique.joue(quoi),
      e: {},
      hasard: Math.random,
      entier: (a, b) => a + Math.floor(Math.random() * (b - a)),
      /** Écrit l'état de la partie. Les jeux longs s'en servent à chaque tour. */
      sauve(donnees) {
        ecris(cle, JSON.stringify(donnees))
      },
      /** Relit l'état, ou null s'il n'y en a pas. */
      charge() {
        try {
          return JSON.parse(lis(cle, 'null'))
        } catch {
          return null
        }
      },
      efface() {
        ecris(cle, 'null')
      },
      fini: false,
      perdu() {
        this.fini = true
      },
    }

    if (options.neuve) j.efface()
    this.j = j
    def.init?.(j)
    // La bande par défaut est celle du jeu ; `init` a pu en demander une autre
    // (BRÈCHE choisit selon le monde), et on ne l'écrase pas.
    if (!musique.voulue) musique.joue(pourJeu(def.id))
    this.phase = this.cat?.decompte ? 'depart' : 'jeu'
    this.phaseT = 0
    this.bip = -1
    this.palier = 0
    this.suggere = null
    this._verifieSuggestion()
  }

  /**
   * Une vie de perdue, mais pas la partie. Le jeu se remet en place et le
   * score reste : c'est ce qui fait passer une partie de quarante secondes à
   * deux ou trois minutes sans toucher à sa difficulté.
   */
  _reprise() {
    const j = this.j
    j.vies--
    const score = j.score
    const def = this.def
    if (def.reprend) def.reprend(j)
    else def.init?.(j)
    j.score = score
    j.fini = false
    j.fx.secoue(9)
    son.rate()
    this.phase = 'reprise'
    this.phaseT = 0
  }

  _termine() {
    this.record = this.def.sansScore ? false : this._enregistre(this.def.id, this.j.score)
    this.phase = 'fin'
    this.phaseT = 0
    son.mort()
    this.j.fx.secoue(11)
    this.j.fx.eclat(this.W / 2, this.H / 2, C.rouge, { n: 26, vitesse: 260, taille: 6, duree: 0.9 })
    if (this.record) setTimeout(() => son.record(), 450)
  }

  _quitte() {
    this.def?.quitte?.(this.j)
    musique.arrete()
    this.phase = this.cat ? 'categorie' : 'accueil'
    this.phaseT = 0
    this.def = null
    this.j = null
    this.suggere = null
    this._redim()
  }

  _bascullePause() {
    if (this.phase === 'jeu') this.phase = 'pause'
    else if (this.phase === 'pause') this.phase = 'jeu'
    this.phaseT = 0
    this.arme = 0
  }

  _maj(dt) {
    this.phaseT += dt
    if (this.arme > 0) this.arme -= dt
    if (!this.j) return

    if (this.phase === 'depart') {
      this.j.fx.maj(dt)
      const bip = Math.floor(this.phaseT / DECOMPTE_PAS)
      if (bip !== this.bip && bip < 3) {
        this.bip = bip
        son.touche(bip === 2 ? 8 : 4)
      }
      if (this.phaseT >= DECOMPTE) this.phase = 'jeu'
      return
    }

    if (this.phase === 'reprise') {
      this.j.fx.maj(dt)
      if (this.phaseT >= REPRISE) this.phase = 'jeu'
      return
    }

    // Les effets continuent de vivre pendant l'écran de fin : la secousse
    // retombe et les grains achèvent leur chute, au lieu de se figer.
    if (this.phase !== 'pause' && this.phase !== 'tourne') this.j.fx.maj(dt)
    if (this.phase !== 'jeu') return

    const j = this.j
    j.t += dt

    // Paliers : sur les jeux courts, un repère toutes les trente secondes.
    // Sans lui, une bonne partie n'a aucune structure, juste une durée.
    if (this.cat?.decompte) {
      const palier = Math.floor(j.t / 30)
      if (palier > this.palier) {
        this.palier = palier
        j.fx.bulle(this.W / 2, this.H / 2 - 60, `PALIER ${palier + 1}`, C.accent, 20)
        son.niveau()
      }
    }

    this.def.maj?.(j, dt)
    if (j.fini) {
      if (j.vies > 1) return this._reprise()
      this._termine()
    }
  }

  // --- Entrées --------------------------------------------------------------

  _appui(p) {
    // Dans le geste de l'utilisateur : seul moment où iOS accepte de démarrer
    // le son.
    son.reveille()

    if (this.phase === 'accueil') {
      if (dans(p, dispoSon(this.W))) return (son.bascule(), musique.accorde())
      const d = dispoAccueil(this.W, this.H)
      const i = CATEGORIES.findIndex((_, k) => dans(p, carteAccueil(k, d)))
      if (i >= 0) {
        son.clic()
        this.cat = CATEGORIES[i]
        this.phase = 'categorie'
        this.phaseT = 0
      }
      return
    }

    if (this.phase === 'categorie') {
      if (dans(p, BTN_RETOUR)) {
        son.clic()
        this.cat = null
        this.phase = 'accueil'
        this.phaseT = 0
        return
      }
      const i = this._indexJeu(p)
      if (i !== null && i < this.cat.jeux.length) {
        son.clic()
        this.lance(this.cat.jeux[i])
      }
      return
    }

    // L'écran d'orientation : un appui reprend, le bouton du bas le fait taire
    // pour de bon.
    if (this.phase === 'tourne') {
      const d = dispoMenu(this.W, this.H, 1)
      const z = boutonMenu(0, { ...d, y: Math.round(this.H * 0.74) })
      if (dans(p, z)) {
        this.muet = true
        ecris(CLE_MUET, '1')
        son.clic()
      } else son.touche(3)
      this.suggere = null
      this.phase = 'jeu'
      return
    }

    // Pendant le décompte et la reprise, tout appui est ignoré : sinon le
    // premier geste part avant que le joueur ait vu l'écran.
    if (this.phase === 'depart' || this.phase === 'reprise') return

    if (this.phase === 'jeu') {
      if (dans(p, { x: 0, y: 0, w: 52, h: HUD })) {
        son.clic()
        return this._bascullePause()
      }
      this.def.appui?.(this.j, p)
      return
    }

    if (this.phase === 'pause') {
      const d = dispoMenu(this.W, this.H, MENU_PAUSE.length)
      const i = MENU_PAUSE.findIndex((_, k) => dans(p, boutonMenu(k, d)))
      if (i !== 1) this.arme = 0
      if (i === 0) return (son.clic(), this._bascullePause())
      if (i === 1) {
        // Sur un jeu persistant, ce bouton efface une partie de plusieurs
        // heures. Un doigt qui glisse ne doit pas pouvoir le faire : il faut
        // le demander deux fois, et l'armement retombe tout seul.
        if (this.def.persistant && this.arme <= 0) {
          this.arme = 4
          return son.rate()
        }
        return (son.clic(), this.lance(this.def, { neuve: true }))
      }
      if (i === 2) return (son.clic(), this._quitte())
      if (i === 3) return (son.bascule(), musique.accorde())
      if (i === 4) return (theme.bascule(), son.clic())
      return
    }

    if (this.phase === 'fin' && this.phaseT > 0.4) {
      const b = this._dispoFin()
      const i = b.findIndex((z) => dans(p, z))
      if (i === 0) return (son.clic(), this.lance(this.def, { neuve: true }))
      if (i === 1) return (son.clic(), this._quitte())
    }
  }

  _relache(p) {
    if (this.phase === 'jeu') this.def.relache?.(this.j, p)
  }

  // --- Rendu ----------------------------------------------------------------

  _dessine() {
    const ctx = this.ctx
    ctx.fillStyle = C.fond
    ctx.fillRect(0, 0, this.W, this.H)

    if (this.phase === 'accueil') this._accueil()
    else if (this.phase === 'categorie') this._categorie()
    else {
      // La dernière image du jeu reste visible sous la pause et sous l'écran
      // de fin : on ne perd jamais de vue ce qui vient de se passer.
      const fx = this.j.fx
      ctx.save()
      ctx.translate(Math.round(fx.dx), Math.round(fx.dy))
      // Un ciel tramé derrière le jeu, quand il en déclare un : une ligne dans
      // sa définition, et l'écran cesse d'être un fond noir.
      if (this.def.ciel) {
        // Assez sombre pour que le HUD des jeux reste lisible par-dessus, et
        // assez haut pour que la trame s'éteigne au lieu de s'arrêter net.
        bandeTramee(ctx, 0, HUD, this.W, this.H - HUD, ton(this.def.ciel, -0.6), 0.5, 0)
      }
      this.def.dessine?.(this.j, ctx)
      fx.dessine(ctx)
      ctx.restore()
      ctx.textAlign = 'center'
      this._bandeau()
      if (this.phase === 'depart') this._depart()
      if (this.phase === 'reprise') this._reprisEcran()
      if (this.phase === 'pause') this._pause()
      if (this.phase === 'tourne') this._tourne()
      if (this.phase === 'fin') this._fin()
    }

    vignette(ctx, this.W, this.H)
    scanlines(ctx, this.W, this.H)
  }

  /**
   * Entrée en fondu, décalée d'un élément à l'autre. Trois lignes, et une
   * liste cesse d'apparaître d'un bloc comme une capture d'écran.
   */
  _entree(i) {
    const k = Math.min(1, Math.max(0, (this.phaseT - i * 0.045) / 0.2))
    return { k: k * (2 - k), dy: (1 - k) * 16 }
  }

  _entete(titre, sousTitre, retour) {
    const ctx = this.ctx
    ctx.textAlign = 'left'
    if (retour) {
      rect(ctx, BTN_RETOUR.x, BTN_RETOUR.y, BTN_RETOUR.w, BTN_RETOUR.h, C.panneau)
      cadre(ctx, BTN_RETOUR.x, BTN_RETOUR.y, BTN_RETOUR.w, BTN_RETOUR.h, C.faible)
      texte(ctx, '< RET', BTN_RETOUR.x + 12, BTN_RETOUR.y + 17, 14, C.texte, 700)
      texte(ctx, titre, 104, 31, 24, C.accent, 700, 190, 2)
    } else {
      const l = largeurTexte(ctx, titre, 26)
      lueur(ctx, 20, 18, l, 24, C.accent, 3, 0.8)
      texte(ctx, titre, 20, 30, 26, C.accent, 700, undefined, 2)
      if (Math.floor(this.phaseT * 2) % 2 === 0) {
        rect(ctx, 20 + l + 10, 22, 12, 18, C.accent)
      }
    }
    ctx.textAlign = 'center'
    rect(ctx, 20, 56, this.W - 40, PX, C.bord)
    if (sousTitre) {
      ctx.textAlign = 'left'
      texte(ctx, sousTitre, 20, 76, 13, C.faible, 700, this.W - 40)
      ctx.textAlign = 'center'
    }
  }

  _accueil() {
    const ctx = this.ctx
    this._entete('> ARKAD')
    this._boutonSon()
    const d = dispoAccueil(this.W, this.H)

    CATEGORIES.forEach((cat, i) => {
      const { k, dy } = this._entree(i)
      if (k <= 0) return
      const z = carteAccueil(i, d)
      const y = z.y + dy
      ctx.globalAlpha = k

      ombre(ctx, z.x, y, z.w, z.h, 5)
      rect(ctx, z.x, y, z.w, z.h, C.panneau)
      rect(ctx, z.x, y, z.w, 3, ton(C.panneau, 0.5))
      cadre(ctx, z.x, y, z.w, z.h, ton(cat.couleur, -0.3))
      // Le bandeau de couleur, allumé : c'est le seul repère de catégorie.
      lueur(ctx, z.x, y + 10, 7, z.h - 20, cat.couleur, 2, 0.9)
      bloc(ctx, z.x, y + 10, 7, z.h - 20, cat.couleur, 2)

      ctx.textAlign = 'left'
      texte(ctx, cat.nom, z.x + 20, y + 26, 24, cat.couleur, 700, z.w - 110, 2)
      texte(ctx, cat.duree, z.x + 20, y + 52, 14, C.texte, 700, z.w - 40)
      texte(ctx, cat.detail, z.x + 20, y + 72, 12, C.faible, 700, z.w - 32)
      ctx.textAlign = 'right'
      const n = cat.jeux.length
      texte(ctx, `${n} ${n > 1 ? 'jeux' : 'jeu'}`, z.x + z.w - 16, y + 26, 14, C.faible, 700)
      ctx.textAlign = 'center'
      ctx.globalAlpha = 1
    })

    const total = CATEGORIES.reduce((n, c) => n + c.jeux.length, 0)
    texte(ctx, `${total} jeux · une seule touche`, this.W / 2, this.H - 28, 12, C.faible, 700)
  }

  _categorie() {
    const cat = this.cat
    this._entete(cat.nom, `${cat.duree} · ${cat.detail}`, true)
    if (enRangees(this.W, this.H, cat.jeux.length)) cat.jeux.forEach((def, i) => this._rangee(def, i))
    else cat.jeux.forEach((def, i) => this._tuile(def, i))
  }

  /** Tuile compacte, pour les catégories qui ont beaucoup de jeux. */
  _tuile(def, i) {
    const ctx = this.ctx
    const t = tuile(i, dispoTuiles(this.W, this.H))
    const { k, dy } = this._entree(i)
    if (k <= 0) return
    const { x, w, h } = t
    const y = t.y + dy
    ctx.globalAlpha = k

    ombre(ctx, x, y, w, h, 4)
    rect(ctx, x, y, w, h, C.panneau)
    rect(ctx, x, y + h - 3, w, 3, ton(C.panneau, -0.5))
    lueur(ctx, x, y, w, 4, def.couleur, 2, 0.7)
    bloc(ctx, x, y, w, 5, def.couleur, 2)

    texte(ctx, def.nom, x + w / 2, y + 26, 13, C.texte, 700, w - 8)
    const best = this.meilleur(def.id)
    texte(ctx, best ? String(best) : '--', x + w / 2, y + 50, 17, best ? C.accent : C.bord, 700, w - 10)
    ctx.globalAlpha = 1
  }

  /** Rangée détaillée, pour les catégories qui n'ont que deux ou trois jeux. */
  _rangee(def, i) {
    const ctx = this.ctx
    const z = rangee(i, dispoRangees(this.W, this.H, this.cat.jeux.length))
    const { k, dy } = this._entree(i)
    if (k <= 0) return
    const y = z.y + dy
    ctx.globalAlpha = k

    ombre(ctx, z.x, y, z.w, z.h, 5)
    rect(ctx, z.x, y, z.w, z.h, C.panneau)
    rect(ctx, z.x, y, z.w, 3, ton(C.panneau, 0.5))
    rect(ctx, z.x, y + z.h - 3, z.w, 3, ton(C.panneau, -0.5))
    lueur(ctx, z.x, y + 8, 6, z.h - 16, def.couleur, 2, 0.9)
    bloc(ctx, z.x, y + 8, 6, z.h - 16, def.couleur, 2)

    ctx.textAlign = 'left'
    texte(ctx, def.nom, z.x + 18, y + 26, 21, C.texte, 700, z.w - 40)
    texte(ctx, def.pitch, z.x + 18, y + 50, 13, C.faible, 700, z.w - 36)

    const best = this.meilleur(def.id)
    const enCours = this.reprise(def)
    const bas = enCours ? 'PARTIE EN COURS' : best ? `record ${best} ${def.unite}`.trim() : 'jamais joué'
    texte(ctx, bas, z.x + 18, y + 74, 13, enCours ? C.accent : best ? C.faible : C.bord, 700, z.w - 36)
    ctx.textAlign = 'center'
    ctx.globalAlpha = 1
  }

  _indexJeu(p) {
    const jeux = this.cat.jeux
    if (!enRangees(this.W, this.H, jeux.length)) {
      const d = dispoTuiles(this.W, this.H)
      const i = jeux.findIndex((_, k) => dans(p, tuile(k, d)))
      return i >= 0 ? i : null
    }
    const d = dispoRangees(this.W, this.H, jeux.length)
    const i = jeux.findIndex((_, k) => dans(p, rangee(k, d)))
    return i >= 0 ? i : null
  }

  _boutonSon() {
    const ctx = this.ctx
    const { x, y, w, h } = dispoSon(this.W)
    rect(ctx, x, y, w, h, C.panneau)
    cadre(ctx, x, y, w, h, son.muet ? C.bord : C.faible)
    // Trois positions, trois glyphes : tout, bruitages seuls, silence.
    const glyphe = son.mode === 'tout' ? '♪' : son.mode === 'bruitages' ? '·' : 'x'
    texte(ctx, glyphe, x + w / 2, y + h / 2, 15, son.muet ? C.faible : C.accent, 700)
  }

  // --- En jeu ---------------------------------------------------------------

  _bandeau() {
    const ctx = this.ctx
    rect(ctx, 0, 0, this.W, HUD, C.fond)
    rect(ctx, 0, HUD - PX, this.W, PX, C.bord)
    rect(ctx, 0, HUD, this.W, 3, 'rgba(0, 0, 0, 0.45)')

    rect(ctx, 12, 14, 28, 26, C.panneau)
    cadre(ctx, 12, 14, 28, 26, C.faible)
    rect(ctx, 21, 20, 4, 14, C.texte)
    rect(ctx, 29, 20, 4, 14, C.texte)

    const titre = this.def.sansScore
      ? (this.def.titreHud?.(this.j) ?? this.def.nom)
      : `${Math.floor(this.j.score)} ${this.def.unite}`
    texte(ctx, titre, this.W / 2, 26, 20, C.texte, 700, this.W - 160)

    if (!this.def.sansScore) {
      ctx.textAlign = 'right'
      const best = Math.max(this.j.meilleur, Math.floor(this.j.score))
      texte(ctx, `REC ${best}`, this.W - 12, 26, 12, C.faible, 700)
      ctx.textAlign = 'center'
    }

    // Les vies restantes, à gauche sous le bouton pause.
    if ((this.def.vies ?? 1) > 1) {
      for (let i = 0; i < this.j.vies; i++) bloc(ctx, 50 + i * 12, 22, 8, 8, C.rouge, 2)
    }
  }

  /** Trois temps avant de lâcher le joueur, sur les jeux qui démarrent vite. */
  _depart() {
    const ctx = this.ctx
    this._voile(0.55)
    const reste = Math.max(0, DECOMPTE - this.phaseT)
    const n = Math.ceil(reste / DECOMPTE_PAS)
    const dedans = 1 - (reste % DECOMPTE_PAS) / DECOMPTE_PAS
    ctx.save()
    ctx.translate(this.W / 2, this.H / 2)
    ctx.scale(1.6 - dedans * 0.6, 1.6 - dedans * 0.6)
    lueur(ctx, -40, -32, 80, 64, n === 1 ? C.accent : C.texte, 3, 0.8)
    texte(ctx, n > 0 ? String(n) : 'GO', 0, 0, 64, n === 1 ? C.accent : C.texte, 700)
    ctx.restore()
    texte(ctx, this.def.pitch, this.W / 2, this.H / 2 + 90, 14, C.faible, 700, this.W - 40)
  }

  /** Le temps de comprendre ce qui vient d'arriver, et de se replacer. */
  _reprisEcran() {
    const ctx = this.ctx
    this._voile(0.5)
    lueur(ctx, this.W / 2 - 80, this.H / 2 - 38, 160, 36, C.rouge, 3, 0.9)
    texte(ctx, 'ENCORE', this.W / 2, this.H / 2 - 20, 34, C.rouge, 700, undefined, 3)
    const reste = this.j.vies
    for (let i = 0; i < reste; i++) bloc(ctx, this.W / 2 - reste * 11 + i * 22, this.H / 2 + 20, 14, 14, C.accent, 2)
    texte(ctx, reste > 1 ? `${reste} vies` : 'dernière vie', this.W / 2, this.H / 2 + 60, 14, C.faible, 700)
  }

  _voile(alpha = 0.86) {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(11, 14, 13, ${alpha})`
    ctx.fillRect(0, 0, this.W, this.H)
  }

  _pause() {
    const ctx = this.ctx
    this._voile()
    const d = dispoMenu(this.W, this.H, MENU_PAUSE.length)
    texte(ctx, '-- PAUSE --', this.W / 2, d.y - 46, 26, C.accent, 700, undefined, 3)
    MENU_PAUSE.forEach((libelle, i) => {
      let l = libelle
      let teinte
      if (i === 3) l = son.libelle
      if (i === 4) l = `IMAGE : ${theme.nom}`
      // Sur un jeu long, « recommencer » efface une partie de plusieurs
      // heures : autant que le bouton le dise, et qu'il le demande deux fois.
      if (i === 1 && this.def.persistant) {
        l = this.arme > 0 ? 'EFFACER ? CONFIRME' : 'NOUVELLE PARTIE'
        if (this.arme > 0) teinte = C.rouge
      }
      bouton(ctx, boutonMenu(i, d), l, i === 0, teinte)
    })
  }

  /**
   * L'écran d'orientation.
   *
   * Il ne bloque rien et ne juge personne : il montre le sens dans lequel ce
   * jeu-là est le plus confortable, et il s'efface au premier appui. Le
   * bouton du bas le fait taire pour de bon — un conseil qu'on voit trois
   * fois par jour n'est plus un conseil.
   */
  _tourne() {
    const ctx = this.ctx
    this._voile(0.9)
    const vers = this.suggere
    const large = vers === 'paysage'
    const cx = this.W / 2
    const cy = Math.round(this.H * 0.36)

    // Deux silhouettes de téléphone : celle qu'on tient, éteinte, et celle
    // qu'on conseille, allumée.
    const dessineTel = (x, y, w, h, teinte, vif) => {
      if (vif) lueur(ctx, x, y, w, h, teinte, 3, 0.8)
      rect(ctx, x, y, w, h, C.panneau)
      cadre(ctx, x, y, w, h, teinte, 3)
      rect(ctx, x + 8, y + 10, w - 16, h - 20, ton(teinte, vif ? -0.55 : -0.78))
    }
    const balance = Math.sin(this.phaseT * 3) * 4
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((balance * Math.PI) / 180)
    if (large) {
      dessineTel(-32, -56, 64, 112, C.bord, false)
      dessineTel(-56 + 120, -32, 112, 64, C.accent, true)
    } else {
      dessineTel(-56 - 60, -32, 112, 64, C.bord, false)
      dessineTel(-32 + 90, -56, 64, 112, C.accent, true)
    }
    ctx.restore()

    // La flèche, en gros pixels : trois blocs qui montent vers la droite.
    for (let i = 0; i < 3; i++) bloc(ctx, cx - 10 + i * 8, cy - 4 - i * 4, 6, 6, C.accent, 2)

    texte(ctx, large ? 'TOURNE L’ÉCRAN' : 'REMETS-LE DROIT', cx, this.H * 0.62, 26, C.accent, 700, this.W - 60, 2)
    texte(
      ctx,
      large ? `${this.def.nom} respire mieux couché` : `${this.def.nom} se joue debout`,
      cx,
      this.H * 0.62 + 30,
      13,
      C.faible,
      700,
      this.W - 60,
    )
    const d = dispoMenu(this.W, this.H, 1)
    bouton(ctx, boutonMenu(0, { ...d, y: Math.round(this.H * 0.74) }), 'NE PLUS PROPOSER', false)
    texte(ctx, 'appuie n’importe où pour continuer', cx, this.H * 0.74 + d.h + 22, 11, C.faible, 700, this.W - 60)
  }

  _dispoFin() {
    const large = estLarge(this.W, this.H)
    const d = dispoMenu(this.W, this.H, 2)
    const y = large ? Math.round(this.H * 0.62) : 404
    return [
      { x: d.x, y, w: d.w, h: large ? 46 : 62 },
      { x: d.x, y: y + (large ? 56 : 76), w: d.w, h: large ? 40 : 54 },
    ]
  }

  _fin() {
    const ctx = this.ctx
    this._voile(0.9)
    const large = estLarge(this.W, this.H)
    const cx = this.W / 2
    // Un jeu peut décider de son titre de fin : « GAGNÉ » n'est pas
    // « GAME OVER », et certains le savent seulement au dernier moment.
    const brut = typeof this.def.finTitre === 'function' ? this.def.finTitre(this.j) : this.def.finTitre
    const fin = brut ?? { texte: 'GAME OVER', couleur: C.rouge }
    const titre = typeof fin === 'string' ? { texte: fin, couleur: C.rouge } : fin
    const teinte = titre.couleur ?? C.rouge
    const yT = large ? Math.round(this.H * 0.16) : 168
    lueur(ctx, cx - 110, yT - 18, 220, 36, teinte, 3, 0.9)
    texte(ctx, titre.texte, cx, yT, 30, teinte, 700, this.W - 30, 2)

    if (!this.def.sansScore) {
      const yS = large ? Math.round(this.H * 0.34) : 252
      lueur(ctx, cx - 90, yS - 30, 180, 60, C.texte, 2, 0.5)
      texte(ctx, `${Math.floor(this.j.score)}`, cx, yS, large ? 48 : 60, C.texte, 700)
      texte(ctx, this.def.unite, cx, yS + 44, 14, C.faible, 700)
      const yR = large ? Math.round(this.H * 0.5) : 342
      if (this.record) texte(ctx, '* NOUVEAU RECORD *', cx, yR, 15, C.accent, 700)
      else texte(ctx, `record ${this.meilleur(this.def.id)}`, cx, yR, 13, C.faible, 700)
    }

    const b = this._dispoFin()
    bouton(ctx, b[0], 'REJOUER', true)
    bouton(ctx, b[1], 'QUITTER', false)
  }
}

// --- Petits blocs partagés ---------------------------------------------------

function bouton(ctx, z, libelle, primaire, teinte) {
  const vif = teinte ?? (primaire ? C.accent : null)
  ombre(ctx, z.x, z.y, z.w, z.h, 5)
  if (vif) lueur(ctx, z.x, z.y, z.w, z.h, vif, 3, 0.7)
  rect(ctx, z.x, z.y, z.w, z.h, C.panneau)
  rect(ctx, z.x, z.y, z.w, 3, ton(C.panneau, 0.55))
  rect(ctx, z.x, z.y + z.h - 3, z.w, 3, ton(C.panneau, -0.55))
  cadre(ctx, z.x, z.y, z.w, z.h, vif ?? C.faible)
  ctx.textAlign = 'center'
  texte(ctx, libelle, z.x + z.w / 2, z.y + z.h / 2, 19, vif ?? C.texte, 700, z.w - 24, 1)
}

export { dispoAccueil, carteAccueil, dispoTuiles, tuile, dispoRangees, rangee, dispoMenu, boutonMenu, dispoSon }
