/**
 * RUÉE — un cube qui court tout droit, et une seule décision : sauter ou non.
 *
 * Le jeu s'apprend par cœur. C'est son sujet : on ne réagit pas, on mémorise.
 * D'où trois choix qui tiennent tout le reste :
 *
 *   - **on recommence instantanément.** Un jeu qui fait attendre entre deux
 *     essais transforme l'apprentissage en corvée ; ici la mort relance au
 *     pas suivant l'appui ;
 *   - **le meilleur pourcentage est le score**, affiché en permanence sur la
 *     barre, avec un trait au record. On voit l'instant exact où on le passe ;
 *   - **l'entraînement pose des repères.** Recommencer au dernier repère au
 *     lieu du début est ce qui rend un niveau long apprenable — et il ne
 *     compte pas dans le record, sinon il n'y aurait plus de record.
 */
import { C } from '../../palette.js'
import { texte, rect } from '../../dessin.js'
import * as L from './logique.js'
import * as V from './vues.js'
import { NIVEAUX, NIVEAU_PAR_ID } from './donnees.js'

const dans = (p, z) => z && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h

/** La teinte d'une course : celle du niveau, pour qu'ils ne se confondent pas. */
const TEINTES = [C.cyan, C.accent, C.violet, C.vert, C.rouge]
const teinteDe = (id) =>
  TEINTES[
    Math.max(
      0,
      NIVEAUX.findIndex((n) => n.id === id),
    ) % TEINTES.length
  ]

export default {
  id: 'ruee',
  nom: 'RUÉE',
  pitch: 'un cube, un doigt, un niveau à apprendre',
  couleur: C.cyan,
  unite: '%',
  persistant: true,
  sansScore: true,
  paysage: true,
  // Un jeu qui défile de gauche à droite veut de la largeur : couché, on voit
  // arriver ce qu'on doit sauter. Debout, on l'apprend par cœur ou on meurt.
  confort: 'paysage',

  titreHud(j) {
    const e = j.e
    if (e.vue !== 'course') return 'RUÉE'
    const n = NIVEAU_PAR_ID[e.course.niveau]
    return `${n.nom} · ${Math.round(L.avancement(e.course) * 100)} %`
  },

  init(j) {
    const p = L.migre(j.charge()) ?? L.progressionNeuve()
    j.e = { vue: 'menu', p, course: null, essai: 0, entrainement: false, mortT: 0, fini: 0 }
  },

  redim() {},

  maj(j, dt) {
    const e = j.e
    if (e.vue !== 'course' || !e.course) return
    const c = e.course

    if (c.mort) {
      // Un délai court, pas nul : sans lui on ne voit pas *où* on est mort,
      // et un jeu qu'on apprend doit montrer sa faute.
      e.mortT += dt
      if (e.mortT > 0.45) this._relance(j)
      return
    }
    if (c.fini) {
      e.fini += dt
      if (e.fini > 1.6) {
        e.vue = 'menu'
        j.musique(pourMenu())
      }
      return
    }

    L.avance(c, dt, j.maintenu)

    if (!e.entrainement) {
      const part = L.avancement(c)
      if (part > (e.p.records[c.niveau] ?? 0)) e.p.records[c.niveau] = part
    }
    if (c.fini && !e.entrainement) {
      e.p.finis.add(c.niveau)
      e.p.records[c.niveau] = 1
      j.son.record()
      this._sauve(j)
    }
    if (c.mort) {
      j.son.mort()
      j.fx.secoue(7)
      this._sauve(j)
    }
  },

  dessine(j, ctx) {
    const e = j.e
    const d = V.dispo(j)
    if (e.vue === 'menu') {
      rect(ctx, 0, j.HUD, j.W, j.H - j.HUD, C.fond)
      V.menu(ctx, d, j, e.p, L.ouvert)
      return
    }

    const c = e.course
    const teinte = teinteDe(c.niveau)
    V.niveau(ctx, d, j, c, teinte)
    V.barre(ctx, d, L.avancement(c), e.entrainement ? 0 : (e.p.records[c.niveau] ?? 0), teinte)

    ctx.textAlign = 'left'
    texte(ctx, `ESSAI ${e.essai}`, 20, d.barre.y + 28, 11, C.faible)
    if (e.entrainement) {
      ctx.textAlign = 'right'
      texte(ctx, 'ENTRAÎNEMENT · sans record', j.W - 20, d.barre.y + 28, 11, C.violet)
    }
    if (c.fini) {
      ctx.textAlign = 'center'
      texte(ctx, 'AU BOUT', j.W / 2, j.H / 2, 30, C.vert, 700, undefined, 4)
    }
    ctx.textAlign = 'center'
  },

  appui(j, p) {
    const e = j.e
    const d = V.dispo(j)

    if (e.vue === 'menu') {
      const i = NIVEAUX.findIndex((n, k) => dans(p, d.carte(k, n)))
      if (i >= 0 && L.ouvert(e.p, NIVEAUX[i].id)) {
        e.p.niveau = NIVEAUX[i].id
        this._commence(j, false)
        return j.son.clic()
      }
      return
    }

    // En course, l'écran entier saute — sauf le bandeau du haut, que le moteur
    // se réserve. On ne vise rien : on appuie.
    if (e.course?.mort && e.mortT > 0.15) return this._relance(j)
  },

  relache() {},

  quitte(j) {
    this._sauve(j)
  },

  // --- Le fil de la partie ---------------------------------------------------------

  _commence(j, entrainement) {
    const e = j.e
    const id = e.p.niveau
    e.entrainement = entrainement
    e.vue = 'course'
    e.essai = (e.p.essais[id] ?? 0) + 1
    e.p.essais[id] = e.essai
    e.mortT = 0
    e.fini = 0
    e.course = L.nouvelle(id, entrainement ? (e.p.reperes[id] ?? 0) : 0)
    j.musique(NIVEAU_PAR_ID[id].bande)
    this._sauve(j)
  },

  _relance(j) {
    this._commence(j, j.e.entrainement)
  },

  _sauve(j) {
    j.sauve(L.sauvegarde(j.e.p))
  },
}

/** La bande du menu : celle du jeu, pas celle d'un niveau. */
const pourMenu = () => 'ruee'
