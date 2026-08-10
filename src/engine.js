/**
 * Le moteur de l'arcade.
 *
 * Il ne sait rien des micro-jeux : il enchaîne des phases (consigne -> jeu ->
 * verdict), compte les vies, accélère avec le score, et transmet les entrées.
 * Tout le reste vit dans src/games/.
 */
import { GAMES } from './games/index.js'
import { Input } from './input.js'
import { C } from './palette.js'
import { texte, rect } from './dessin.js'

export const W = 360
export const H = 640

const DUREE_CONSIGNE = 0.9
const DUREE_VERDICT = 0.8
const VIES = 4
const VITESSE_MAX = 2.2

/** Générateur pseudo-aléatoire à graine : une même graine rejoue la même partie. */
function graine(s) {
  return function () {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Moteur {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')

    this.input = new Input(canvas, W, H)
    this.input.onPress = (p) => this._appui(p)
    this.input.onRelease = (p) => this._relache(p)

    this.phase = 'menu' // menu | liste | consigne | jeu | verdict | fin
    this.phaseT = 0
    this.score = 0
    this.record = Number(localStorage.getItem('arcade.record') || 0)
    this.vies = VIES
    this.vitesse = 1
    this.libre = null // le micro-jeu joué en boucle en mode libre, sinon null
    this.jeu = null
    this.g = null
    this.verdict = null // 'gagne' | 'perd'
    this.precedent = null

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
    const dpr = Math.min(devicePixelRatio || 1, 3)
    this.canvas.width = Math.round(W * dpr)
    this.canvas.height = Math.round(H * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
  }

  // --- Déroulé de la partie -------------------------------------------------

  _nouvellePartie(libre = null) {
    this.score = 0
    this.vies = libre ? Infinity : VIES
    this.vitesse = 1
    this.libre = libre
    this.precedent = null
    this._prepare(libre || this._tire())
  }

  _tire() {
    if (GAMES.length === 1) return GAMES[0]
    let def
    do {
      def = GAMES[Math.floor(Math.random() * GAMES.length)]
    } while (def === this.precedent)
    return def
  }

  _prepare(def) {
    this.jeu = def
    this.precedent = def
    this.phase = 'consigne'
    this.phaseT = 0
  }

  _lance() {
    const def = this.jeu
    const rnd = graine((Math.random() * 1e9) | 0)
    const g = {
      W,
      H,
      t: 0,
      duree: def.duree ?? 4,
      restant: def.duree ?? 4,
      vitesse: this.vitesse,
      score: this.score,
      pointer: this.input.pointer,
      get maintenu() {
        return this.__input.held
      },
      __input: this.input,
      e: {}, // état libre du micro-jeu
      hasard: rnd,
      /** Renvoie un entier dans [a, b[. */
      entier: (a, b) => a + Math.floor(rnd() * (b - a)),
      resultat: null,
      gagne() {
        if (!this.resultat) this.resultat = 'gagne'
      },
      perd() {
        if (!this.resultat) this.resultat = 'perd'
      },
    }
    this.g = g
    def.init?.(g)
    this.phase = 'jeu'
    this.phaseT = 0
  }

  _termine(resultat) {
    this.verdict = resultat
    this.phase = 'verdict'
    this.phaseT = 0
    if (resultat === 'gagne') {
      this.score++
      if (!this.libre) {
        this.vitesse = Math.min(1 + Math.floor(this.score / 4) * 0.12, VITESSE_MAX)
      }
    } else {
      this.vies--
    }
  }

  _suivant() {
    if (this.vies <= 0) {
      this.phase = 'fin'
      this.phaseT = 0
      if (this.score > this.record) {
        this.record = this.score
        localStorage.setItem('arcade.record', String(this.record))
      }
      return
    }
    this._prepare(this.libre || this._tire())
  }

  _maj(dt) {
    this.phaseT += dt

    if (this.phase === 'consigne') {
      if (this.phaseT >= DUREE_CONSIGNE) this._lance()
      return
    }

    if (this.phase === 'jeu') {
      const g = this.g
      const dtj = dt * this.vitesse
      g.t += dtj
      g.restant = Math.max(0, g.duree - g.t)
      this.jeu.maj?.(g, dtj)
      if (!g.resultat && g.restant <= 0) {
        g.resultat = this.jeu.siTempsEcoule || 'perd'
      }
      if (g.resultat) this._termine(g.resultat)
      return
    }

    if (this.phase === 'verdict' && this.phaseT >= DUREE_VERDICT) {
      this._suivant()
    }
  }

  // --- Entrées --------------------------------------------------------------

  _appui(p) {
    if (this.phase === 'menu') {
      if (dansRect(p, 40, 356, 280, 76)) this._nouvellePartie()
      else if (dansRect(p, 40, 448, 280, 60)) {
        this.phase = 'liste'
        this.phaseT = 0
      }
      return
    }

    if (this.phase === 'liste') {
      if (dansRect(p, 20, 24, 120, 44)) {
        this.phase = 'menu'
        return
      }
      const i = Math.floor((p.y - 110) / 54)
      if (i >= 0 && i < GAMES.length && p.y >= 110) this._nouvellePartie(GAMES[i])
      return
    }

    if (this.phase === 'jeu') {
      // Le retour au menu reste accessible en mode libre.
      if (this.libre && dansRect(p, 0, 0, 70, 44)) {
        this.phase = 'menu'
        return
      }
      this.jeu.appui?.(this.g, p)
      return
    }

    if (this.phase === 'fin' && this.phaseT > 0.5) {
      this.phase = 'menu'
    }
  }

  _relache(p) {
    if (this.phase === 'jeu') this.jeu.relache?.(this.g, p)
  }

  // --- Rendu ----------------------------------------------------------------

  _dessine() {
    const ctx = this.ctx
    ctx.fillStyle = C.fond
    ctx.fillRect(0, 0, W, H)

    if (this.phase === 'menu') return this._menu()
    if (this.phase === 'liste') return this._liste()
    if (this.phase === 'consigne') return this._consigne()
    if (this.phase === 'fin') return this._fin()

    // jeu + verdict partagent le même écran : le verdict s'affiche par-dessus
    // la dernière image du jeu, ce qui rend l'enchaînement beaucoup plus lisible.
    this.jeu.dessine?.(this.g, ctx)
    this._hud()
    if (this.phase === 'verdict') this._voile()
  }

  _menu() {
    const ctx = this.ctx
    texte(ctx, 'ARCADE', W / 2, 200, 62, C.joueur, 900)
    texte(ctx, '5 secondes par jeu', W / 2, 250, 17, C.faible, 600)
    if (this.record) texte(ctx, `record : ${this.record}`, W / 2, 280, 15, C.or, 700)

    rect(ctx, 40, 356, 280, 76, C.joueur, 16)
    texte(ctx, 'JOUER', W / 2, 394, 30, C.fond, 900)

    rect(ctx, 40, 448, 280, 60, C.fondClair, 16)
    texte(ctx, 'MODE LIBRE', W / 2, 478, 20, C.texte, 700)

    texte(ctx, `${GAMES.length} jeux · une seule touche`, W / 2, 570, 14, C.faible, 600)
  }

  _liste() {
    const ctx = this.ctx
    rect(ctx, 20, 24, 120, 44, C.fondClair, 12)
    texte(ctx, '← retour', 80, 46, 16, C.texte, 700)
    texte(ctx, 'MODE LIBRE', W / 2, 90, 22, C.faible, 800)

    GAMES.forEach((def, i) => {
      const y = 110 + i * 54
      rect(ctx, 24, y, W - 48, 46, C.fondClair, 12)
      ctx.textAlign = 'left'
      texte(ctx, def.consigne, 44, y + 23, 17, C.texte, 700)
      ctx.textAlign = 'center'
    })
  }

  _consigne() {
    const ctx = this.ctx
    // Le mot d'ordre arrive en grossissant : c'est tout ce qui tient lieu de tutoriel.
    const p = Math.min(this.phaseT / 0.18, 1)
    const echelle = 0.6 + 0.4 * p * (2 - p)
    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.scale(echelle, echelle)
    texte(ctx, this.jeu.consigne, 0, 0, 40, C.texte, 900)
    ctx.restore()
    if (!this.libre) texte(ctx, `${this.score}`, W / 2, H - 60, 20, C.faible, 800)
  }

  _hud() {
    const ctx = this.ctx
    const g = this.g

    // Barre de temps : la seule information dont le joueur a besoin.
    const part = g.duree > 0 ? g.restant / g.duree : 0
    rect(ctx, 0, 0, W, 6, C.fondClair)
    rect(ctx, 0, 0, W * part, 6, part > 0.3 ? C.joueur : C.danger)

    if (this.libre) {
      texte(ctx, '←', 24, 26, 20, C.faible, 800)
      return
    }

    ctx.textAlign = 'left'
    texte(ctx, `${this.score}`, 14, 26, 18, C.faible, 800)
    ctx.textAlign = 'center'
    for (let i = 0; i < VIES; i++) {
      const plein = i < this.vies
      rect(ctx, W - 20 - i * 16, 20, 10, 10, plein ? C.danger : C.fondClair, 3)
    }
  }

  _voile() {
    const ctx = this.ctx
    ctx.fillStyle = 'rgba(13, 11, 26, 0.72)'
    ctx.fillRect(0, 0, W, H)
    const ok = this.verdict === 'gagne'
    texte(ctx, ok ? 'OK !' : 'RATÉ', W / 2, H / 2, 54, ok ? C.joueur : C.danger, 900)
  }

  _fin() {
    const ctx = this.ctx
    texte(ctx, 'PERDU', W / 2, 230, 50, C.danger, 900)
    texte(ctx, `${this.score}`, W / 2, 320, 84, C.texte, 900)
    texte(ctx, 'jeux réussis', W / 2, 372, 16, C.faible, 600)
    texte(ctx, `record : ${this.record}`, W / 2, 420, 16, C.or, 700)
    if (this.phaseT > 0.5 && Math.floor(this.phaseT * 2) % 2 === 0) {
      texte(ctx, 'appuie pour recommencer', W / 2, 520, 16, C.faible, 600)
    }
  }
}

function dansRect(p, x, y, w, h) {
  return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h
}
