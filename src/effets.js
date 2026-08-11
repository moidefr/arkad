/**
 * Les effets partagés : grains qui giclent, bulles de score, secousse d'écran.
 *
 * C'est ce qui sépare un jeu qui marche d'un jeu qui fait plaisir. Un jeu
 * appelle `j.fx.eclat(...)` au moment où quelque chose se passe, et le moteur
 * s'occupe de tout dessiner par-dessus, dans le repère du jeu.
 *
 * Les grains sont de simples carrés : même grammaire que le reste de la borne.
 */
import { texte, rect } from './dessin.js'

const MAX_GRAINS = 260

export class Effets {
  constructor() {
    this.grains = []
    this.bulles = []
    this.secousse = 0
    this.dx = 0
    this.dy = 0
  }

  vide() {
    this.grains.length = 0
    this.bulles.length = 0
    this.secousse = 0
  }

  /** Une gerbe dans toutes les directions : impact, ramassage, explosion. */
  eclat(x, y, couleur, { n = 10, vitesse = 150, taille = 4, duree = 0.5, gravite = 300 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = vitesse * (0.35 + Math.random() * 0.85)
      this._ajoute({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vie: duree * (0.6 + Math.random() * 0.6),
        taille,
        couleur,
        g: gravite,
      })
    }
  }

  /** Un jet dirigé : réacteur, poussière d'atterrissage, traînée. */
  jet(x, y, couleur, { angle = Math.PI / 2, ouverture = 0.6, n = 3, vitesse = 120, taille = 3, duree = 0.35, gravite = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * ouverture
      const v = vitesse * (0.5 + Math.random() * 0.8)
      this._ajoute({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vie: duree * (0.6 + Math.random() * 0.6),
        taille,
        couleur,
        g: gravite,
      })
    }
  }

  /** Un nombre qui monte et s'efface : « +40 » au moment où on l'encaisse. */
  bulle(x, y, contenu, couleur, taille = 15) {
    this.bulles.push({ x, y, contenu: String(contenu), couleur, taille, vie: 0.75, duree: 0.75 })
    if (this.bulles.length > 24) this.bulles.shift()
  }

  secoue(force) {
    this.secousse = Math.max(this.secousse, force)
  }

  _ajoute(g) {
    g.duree = g.vie
    this.grains.push(g)
    // On jette les plus vieux plutôt que de laisser la liste enfler : un
    // grain de plus ou de moins ne se voit pas, une chute d'images si.
    if (this.grains.length > MAX_GRAINS) this.grains.splice(0, this.grains.length - MAX_GRAINS)
  }

  maj(dt) {
    for (const g of this.grains) {
      g.vie -= dt
      g.vy += g.g * dt
      g.x += g.vx * dt
      g.y += g.vy * dt
    }
    if (this.grains.length) this.grains = this.grains.filter((g) => g.vie > 0)

    for (const b of this.bulles) {
      b.vie -= dt
      b.y -= 42 * dt
    }
    if (this.bulles.length) this.bulles = this.bulles.filter((b) => b.vie > 0)

    this.secousse = Math.max(0, this.secousse - dt * 34)
    this.dx = this.secousse ? (Math.random() * 2 - 1) * this.secousse : 0
    this.dy = this.secousse ? (Math.random() * 2 - 1) * this.secousse : 0
  }

  dessine(ctx) {
    for (const g of this.grains) {
      // Le grain rétrécit en mourant : plus lisible qu'une transparence, et
      // fidèle au reste du dessin.
      const k = g.vie / g.duree
      const t = Math.max(2, Math.round((g.taille * (0.4 + k * 0.6)) / 2) * 2)
      rect(ctx, g.x - t / 2, g.y - t / 2, t, t, g.couleur)
    }

    ctx.textAlign = 'center'
    for (const b of this.bulles) {
      texte(ctx, b.contenu, b.x, b.y, b.taille, b.couleur, 700)
    }
  }
}
