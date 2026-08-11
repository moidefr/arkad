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
 */
import { CATEGORIES } from './catalogue.js'
import { Input } from './input.js'
import { C } from './palette.js'
import { son } from './son.js'
import { Effets } from './effets.js'
import { lis, ecris } from './stockage.js'
import { texte, rect, cadre, scanlines, largeurTexte, PX } from './dessin.js'

export const W = 360
export const H = 640

/** Hauteur du bandeau du haut pendant une partie. */
export const HUD = 56

const BTN_SON = { x: 302, y: 16, w: 40, h: 30 }
const BTN_RETOUR = { x: 16, y: 14, w: 74, h: 34 }

// Accueil : une carte par catégorie.
const CAT_Y = 96
const CAT_H = 88
const CAT_PAS = 102

// Catégorie : grille serrée quand il y a beaucoup de jeux, sinon des rangées.
const GRILLE = { x: 20, y: 116, cols: 4, w: 74, h: 70, ecart: 8 }
const RANGEE = { x: 20, y: 130, w: 320, h: 92, ecart: 14 }

const B_PAUSE = [
  { y: 250, h: 56, libelle: 'REPRENDRE' },
  { y: 318, h: 56, libelle: 'RECOMMENCER' },
  { y: 386, h: 56, libelle: 'QUITTER' },
  { y: 454, h: 56, libelle: 'SON' },
]
const B_FIN = [
  { y: 404, h: 62, libelle: 'REJOUER' },
  { y: 480, h: 54, libelle: 'QUITTER' },
]
const DECOMPTE_PAS = 0.42
const DECOMPTE = DECOMPTE_PAS * 3

const MENU_X = 50
const MENU_W = 260

export class Moteur {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.input = new Input(canvas, W, H)
    this.input.onPress = (p) => this._appui(p)
    this.input.onRelease = (p) => this._relache(p)

    this.phase = 'accueil' // accueil | categorie | depart | jeu | pause | fin
    this.phaseT = 0
    this.cat = null
    this.def = null
    this.j = null
    this.record = false

    addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this._bascullePause()
    })

    this._redim()
    addEventListener('resize', () => this._redim())
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

  _redim() {
    // À la densité réelle de l'écran : c'est ce qui rend le texte net. Le côté
    // pixel vient des formes, pas d'une toile basse résolution.
    const dpr = Math.min(devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
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
    // On recentre le pointeur : sinon un jeu qui suit le doigt démarre là où
    // on a appuyé sur sa tuile, ce qui peut le tuer avant la première image.
    this.input.pointer.x = W / 2
    this.input.pointer.y = H / 2

    const cle = 'sauve.' + def.id
    const j = {
      W,
      H,
      HUD,
      t: 0,
      score: 0,
      meilleur: this.meilleur(def.id),
      pointer: this.input.pointer,
      son,
      fx: new Effets(),
      __input: this.input,
      get maintenu() {
        return this.__input.held
      },
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
    this.phase = this.cat?.decompte ? 'depart' : 'jeu'
    this.phaseT = 0
    this.bip = -1
  }

  _termine() {
    this.record = this.def.sansScore ? false : this._enregistre(this.def.id, this.j.score)
    this.phase = 'fin'
    this.phaseT = 0
    son.mort()
    this.j.fx.secoue(11)
    this.j.fx.eclat(W / 2, H / 2, C.rouge, { n: 26, vitesse: 260, taille: 6, duree: 0.9 })
    if (this.record) setTimeout(() => son.record(), 450)
  }

  _quitte() {
    this.def?.quitte?.(this.j)
    this.phase = this.cat ? 'categorie' : 'accueil'
    this.phaseT = 0
    this.def = null
    this.j = null
  }

  _bascullePause() {
    if (this.phase === 'jeu') this.phase = 'pause'
    else if (this.phase === 'pause') this.phase = 'jeu'
    this.phaseT = 0
  }

  _maj(dt) {
    this.phaseT += dt
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

    // Les effets continuent de vivre pendant l'écran de fin : la secousse
    // retombe et les grains achèvent leur chute, au lieu de se figer.
    if (this.phase !== 'pause') this.j.fx.maj(dt)
    if (this.phase !== 'jeu') return

    const j = this.j
    j.t += dt
    this.def.maj?.(j, dt)
    if (j.fini) this._termine()
  }

  // --- Entrées --------------------------------------------------------------

  _appui(p) {
    // Dans le geste de l'utilisateur : seul moment où iOS accepte de démarrer
    // le son.
    son.reveille()

    if (this.phase === 'accueil') {
      if (dans(p, BTN_SON.x, BTN_SON.y, BTN_SON.w, BTN_SON.h)) return son.bascule()
      const i = Math.floor((p.y - CAT_Y) / CAT_PAS)
      if (i >= 0 && i < CATEGORIES.length && p.y >= CAT_Y && p.y <= CAT_Y + i * CAT_PAS + CAT_H) {
        son.clic()
        this.cat = CATEGORIES[i]
        this.phase = 'categorie'
        this.phaseT = 0
      }
      return
    }

    if (this.phase === 'categorie') {
      if (dans(p, BTN_RETOUR.x, BTN_RETOUR.y, BTN_RETOUR.w, BTN_RETOUR.h)) {
        son.clic()
        this.cat = null
        this.phase = 'accueil'
        return
      }
      const i = this._indexJeu(p)
      if (i !== null && i < this.cat.jeux.length) {
        son.clic()
        this.lance(this.cat.jeux[i])
      }
      return
    }

    // Pendant le décompte, tout appui est ignoré : sinon le premier geste
    // part avant que le joueur ait vu l'écran.
    if (this.phase === 'depart') return

    if (this.phase === 'jeu') {
      if (dans(p, 0, 0, 52, HUD)) {
        son.clic()
        return this._bascullePause()
      }
      this.def.appui?.(this.j, p)
      return
    }

    if (this.phase === 'pause') {
      const i = index(p, B_PAUSE)
      if (i === 0) return son.clic(), this._bascullePause()
      if (i === 1) return son.clic(), this.lance(this.def, { neuve: true })
      if (i === 2) return son.clic(), this._quitte()
      if (i === 3) return son.bascule()
      return
    }

    if (this.phase === 'fin' && this.phaseT > 0.4) {
      const i = index(p, B_FIN)
      if (i === 0) return son.clic(), this.lance(this.def, { neuve: true })
      if (i === 1) return son.clic(), this._quitte()
    }
  }

  _relache(p) {
    if (this.phase === 'jeu') this.def.relache?.(this.j, p)
  }

  // --- Rendu ----------------------------------------------------------------

  _dessine() {
    const ctx = this.ctx
    ctx.fillStyle = C.fond
    ctx.fillRect(0, 0, W, H)

    if (this.phase === 'accueil') this._accueil()
    else if (this.phase === 'categorie') this._categorie()
    else {
      // La dernière image du jeu reste visible sous la pause et sous l'écran
      // de fin : on ne perd jamais de vue ce qui vient de se passer.
      const fx = this.j.fx
      ctx.save()
      ctx.translate(Math.round(fx.dx), Math.round(fx.dy))
      this.def.dessine?.(this.j, ctx)
      fx.dessine(ctx)
      ctx.restore()
      ctx.textAlign = 'center'
      this._bandeau()
      if (this.phase === 'depart') this._depart()
      if (this.phase === 'pause') this._pause()
      if (this.phase === 'fin') this._fin()
    }

    scanlines(ctx, W, H)
  }

  _entete(titre, sousTitre, retour) {
    const ctx = this.ctx
    ctx.textAlign = 'left'
    if (retour) {
      cadre(ctx, BTN_RETOUR.x, BTN_RETOUR.y, BTN_RETOUR.w, BTN_RETOUR.h, C.faible)
      texte(ctx, '< RET', BTN_RETOUR.x + 12, BTN_RETOUR.y + 17, 14, C.texte, 700)
      texte(ctx, titre, 104, 31, 24, C.accent, 700, 190)
    } else {
      texte(ctx, titre, 20, 30, 26, C.accent, 700)
      if (Math.floor(this.phaseT * 2) % 2 === 0) {
        rect(ctx, 20 + largeurTexte(ctx, titre, 26) + 8, 22, 12, 18, C.accent)
      }
    }
    ctx.textAlign = 'center'
    rect(ctx, 20, 56, 320, PX, C.bord)
    if (sousTitre) {
      ctx.textAlign = 'left'
      texte(ctx, sousTitre, 20, 76, 13, C.faible, 700, 320)
      ctx.textAlign = 'center'
    }
  }

  _accueil() {
    const ctx = this.ctx
    this._entete('> ARKAD')
    this._boutonSon()

    CATEGORIES.forEach((cat, i) => {
      const y = CAT_Y + i * CAT_PAS
      rect(ctx, 20, y, 320, CAT_H, C.panneau)
      cadre(ctx, 20, y, 320, CAT_H, cat.couleur)

      ctx.textAlign = 'left'
      texte(ctx, cat.nom, 36, y + 26, 24, cat.couleur, 700)
      texte(ctx, cat.duree, 36, y + 52, 14, C.texte, 700, 240)
      texte(ctx, cat.detail, 36, y + 72, 12, C.faible, 700, 268)
      ctx.textAlign = 'right'
      const n = cat.jeux.length
      texte(ctx, `${n} ${n > 1 ? 'jeux' : 'jeu'}`, 324, y + 26, 14, C.faible, 700)
      ctx.textAlign = 'center'
    })

    texte(ctx, `${CATEGORIES.reduce((n, c) => n + c.jeux.length, 0)} jeux · une seule touche`, W / 2, 612, 12, C.faible, 700)
  }

  _categorie() {
    const ctx = this.ctx
    const cat = this.cat
    this._entete(cat.nom, `${cat.duree} · ${cat.detail}`, true)

    if (cat.jeux.length > 6) cat.jeux.forEach((def, i) => this._tuile(def, i))
    else cat.jeux.forEach((def, i) => this._rangee(def, i))
  }

  /** Tuile compacte, pour les catégories qui ont beaucoup de jeux. */
  _tuile(def, i) {
    const ctx = this.ctx
    const { x, y, w, h } = tuile(i)
    rect(ctx, x, y, w, h, C.panneau)
    rect(ctx, x, y, w, 4, def.couleur)

    texte(ctx, def.nom, x + w / 2, y + 24, 13, C.texte, 700, w - 8)
    const best = this.meilleur(def.id)
    texte(ctx, best ? String(best) : '--', x + w / 2, y + 48, 17, best ? C.accent : C.bord, 700, w - 10)
  }

  /** Rangée détaillée, pour les catégories qui n'ont que deux ou trois jeux. */
  _rangee(def, i) {
    const ctx = this.ctx
    const y = RANGEE.y + i * (RANGEE.h + RANGEE.ecart)
    rect(ctx, RANGEE.x, y, RANGEE.w, RANGEE.h, C.panneau)
    rect(ctx, RANGEE.x, y, 5, RANGEE.h, def.couleur)

    ctx.textAlign = 'left'
    texte(ctx, def.nom, RANGEE.x + 18, y + 26, 21, C.texte, 700, 230)
    texte(ctx, def.pitch, RANGEE.x + 18, y + 50, 13, C.faible, 700, 284)

    const best = this.meilleur(def.id)
    const enCours = this.reprise(def)
    const bas = enCours ? 'PARTIE EN COURS' : best ? `record ${best} ${def.unite}`.trim() : 'jamais joué'
    texte(ctx, bas, RANGEE.x + 18, y + 74, 13, enCours ? C.accent : best ? C.faible : C.bord, 700, 284)
    ctx.textAlign = 'center'
  }

  _indexJeu(p) {
    if (this.cat.jeux.length > 6) {
      const c = Math.floor((p.x - GRILLE.x) / (GRILLE.w + GRILLE.ecart))
      const r = Math.floor((p.y - GRILLE.y) / (GRILLE.h + GRILLE.ecart))
      if (c < 0 || c >= GRILLE.cols || r < 0 || p.x < GRILLE.x || p.y < GRILLE.y) return null
      const i = r * GRILLE.cols + c
      const t = tuile(i)
      return dans(p, t.x, t.y, t.w, t.h) ? i : null
    }
    const pas = RANGEE.h + RANGEE.ecart
    const i = Math.floor((p.y - RANGEE.y) / pas)
    if (i < 0 || p.y < RANGEE.y) return null
    const y = RANGEE.y + i * pas
    return dans(p, RANGEE.x, y, RANGEE.w, RANGEE.h) ? i : null
  }

  _boutonSon() {
    const ctx = this.ctx
    const { x, y, w, h } = BTN_SON
    cadre(ctx, x, y, w, h, son.muet ? C.bord : C.faible)
    texte(ctx, son.muet ? 'x' : '♪', x + w / 2, y + h / 2, 15, son.muet ? C.faible : C.accent, 700)
  }

  // --- En jeu ---------------------------------------------------------------

  _bandeau() {
    const ctx = this.ctx
    rect(ctx, 0, 0, W, HUD, C.fond)
    rect(ctx, 0, HUD - PX, W, PX, C.bord)

    cadre(ctx, 12, 14, 28, 26, C.faible)
    rect(ctx, 21, 20, 4, 14, C.texte)
    rect(ctx, 29, 20, 4, 14, C.texte)

    const titre = this.def.sansScore
      ? this.def.titreHud?.(this.j) ?? this.def.nom
      : `${Math.floor(this.j.score)} ${this.def.unite}`
    texte(ctx, titre, W / 2, 26, 20, C.texte, 700, 200)

    if (!this.def.sansScore) {
      ctx.textAlign = 'right'
      const best = Math.max(this.j.meilleur, Math.floor(this.j.score))
      texte(ctx, `REC ${best}`, W - 12, 26, 12, C.faible, 700)
      ctx.textAlign = 'center'
    }
  }

  /** Trois temps avant de lâcher le joueur, sur les jeux qui démarrent vite. */
  _depart() {
    const ctx = this.ctx
    this._voile(0.55)
    const reste = Math.max(0, DECOMPTE - this.phaseT)
    const n = Math.ceil(reste / DECOMPTE_PAS)
    const dans = 1 - ((reste % DECOMPTE_PAS) / DECOMPTE_PAS)
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(1.6 - dans * 0.6, 1.6 - dans * 0.6)
    texte(ctx, n > 0 ? String(n) : 'GO', 0, 0, 64, n === 1 ? C.accent : C.texte, 700)
    ctx.restore()
    texte(ctx, this.def.pitch, W / 2, H / 2 + 90, 14, C.faible, 700, 320)
  }

  _voile(alpha = 0.86) {
    const ctx = this.ctx
    ctx.fillStyle = `rgba(11, 14, 13, ${alpha})`
    ctx.fillRect(0, 0, W, H)
  }

  _pause() {
    const ctx = this.ctx
    this._voile()
    texte(ctx, '-- PAUSE --', W / 2, 174, 26, C.accent, 700)
    B_PAUSE.forEach((b, i) => {
      let libelle = b.libelle
      if (i === 3) libelle = son.muet ? 'SON : NON' : 'SON : OUI'
      // Sur un jeu long, « recommencer » efface une partie de plusieurs
      // heures : autant que le bouton le dise.
      if (i === 1 && this.def.persistant) libelle = 'NOUVELLE PARTIE'
      bouton(ctx, b.y, b.h, libelle, i === 0)
    })
  }

  _fin() {
    const ctx = this.ctx
    this._voile(0.9)
    // Un jeu peut décider de son titre de fin : « GAGNÉ » n'est pas
    // « GAME OVER », et certains le savent seulement au dernier moment.
    const brut = typeof this.def.finTitre === 'function' ? this.def.finTitre(this.j) : this.def.finTitre
    const fin = brut ?? { texte: 'GAME OVER', couleur: C.rouge }
    const titre = typeof fin === 'string' ? { texte: fin, couleur: C.rouge } : fin
    texte(ctx, titre.texte, W / 2, 168, 30, titre.couleur ?? C.rouge, 700)

    if (!this.def.sansScore) {
      texte(ctx, `${Math.floor(this.j.score)}`, W / 2, 252, 60, C.texte, 700)
      texte(ctx, this.def.unite, W / 2, 296, 14, C.faible, 700)
      if (this.record) texte(ctx, '* NOUVEAU RECORD *', W / 2, 342, 15, C.accent, 700)
      else texte(ctx, `record ${this.meilleur(this.def.id)}`, W / 2, 342, 13, C.faible, 700)
    }

    B_FIN.forEach((b, i) => bouton(ctx, b.y, b.h, b.libelle, i === 0))
  }
}

// --- Petits blocs partagés ---------------------------------------------------

function tuile(i) {
  const c = i % GRILLE.cols
  const r = Math.floor(i / GRILLE.cols)
  return {
    x: GRILLE.x + c * (GRILLE.w + GRILLE.ecart),
    y: GRILLE.y + r * (GRILLE.h + GRILLE.ecart),
    w: GRILLE.w,
    h: GRILLE.h,
  }
}

function bouton(ctx, y, h, libelle, primaire) {
  const couleur = primaire ? C.accent : C.faible
  rect(ctx, MENU_X, y, MENU_W, h, C.panneau)
  cadre(ctx, MENU_X, y, MENU_W, h, couleur)
  texte(ctx, libelle, MENU_X + MENU_W / 2, y + h / 2, 19, primaire ? C.accent : C.texte, 700, MENU_W - 24)
}

function index(p, boutons) {
  return boutons.findIndex((b) => dans(p, MENU_X, b.y, MENU_W, b.h))
}

function dans(p, x, y, w, h) {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
}
