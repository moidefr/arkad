import { C } from '../palette.js'
import { lis, ecris } from '../stockage.js'
import * as K from './anomalie/combat.js'
import * as IA from './anomalie/ia.js'
import * as E from './anomalie/etat.js'
import { COMP } from './anomalie/donnees/competences.js'
import { CLASSE } from './anomalie/donnees/classes.js'
import * as Carte from './anomalie/carte.js'
import * as VC from './anomalie/vue/combat.js'
import * as VM from './anomalie/vue/menus.js'
import * as VK from './anomalie/vue/carte.js'
import * as VE from './anomalie/vue/equipe.js'
import { PROC } from './anomalie/donnees/ennemis.js'
import * as SF from './anomalie/sansfin.js'

/**
 * ANOMALIE — trois opérateurs plongent dans un système corrompu.
 *
 * Il remplace ASCENSION, qui n'était pas déséquilibré mais **inopérant** : une
 * défaite y rapportait un point, garder ne faisait jamais perdre d'intégrité,
 * on ramassait les huit reliques du jeu dès le quatrième rang, et la mémoire
 * de son « IA qui apprend » était effacée avant chaque duel.
 *
 * Ce fichier ne fait que router : toute la règle est dans `anomalie/combat.js`,
 * qui ne connaît ni canvas ni stockage et tourne sous `node --test`.
 */

/**
 * La méta vit dans **sa propre clé**.
 *
 * Le moteur appelle `j.efface()` quand on choisit NOUVELLE PARTIE : passer les
 * déblocages par `j.sauve()` les effacerait avec la partie. `stockage.js` est
 * fait pour ça — c'est le même chemin que les records.
 */
const CLE_META = 'anomalie.meta'
const metaVide = { victoires: 0, plongees: 0, profondeur: 0, profondeurSeul: 0, victoiresSeul: 0 }

const litMeta = () => {
  try {
    return { ...metaVide, ...JSON.parse(lis(CLE_META, '{}')) }
  } catch {
    return { ...metaVide }
  }
}
const ecritMeta = (m) => ecris(CLE_META, JSON.stringify(m))

export default {
  id: 'anomalie',
  nom: 'ANOMALIE',
  pitch: 'Trois opérateurs dans un système corrompu. Tour par tour',
  couleur: C.accent,
  unite: '',
  persistant: true,
  sansScore: true,
  ciel: C.violet,

  titreHud: (j) => (j.e.p ? Carte.acteDe(j.e.p.acte, j.e.p.mode).nom : 'ANOMALIE'),
  finTitre: (j) =>
    j.e.gagne ? { texte: 'SYSTÈME PURGÉ', couleur: C.accent } : { texte: 'DÉCONNEXION', couleur: C.rouge },

  init(j) {
    j.e.meta = litMeta()
    j.e.zones = []
    j.e.choisie = null
    j.e.jette = null
    j.e.prises = []
    j.e.gagne = false
    j.e.attente = 0
    j.e.equipage = 3
    j.e.sel = 0
    j.e.detail = null
    j.e.choisi = null

    const brut = E.migre(j.charge())
    if (brut) {
      j.e.p = brut
      j.e.c = brut.combat ? E.reprend(brut, brut.combat, K.commence) : null
      if (j.e.c) IA.annonce(j.e.c)
      j.e.vue = j.e.c ? 'combat' : brut.position ? 'noeud' : 'carte'
    } else {
      j.e.p = null
      j.e.vue = 'titre'
    }
  },

  /**
   * Le temps ne sert qu'à laisser respirer les tours adverses : le combat lui
   * même est au tour par tour, rien ne s'anime tout seul.
   */
  maj(j, dt) {
    if (j.e.vue !== 'combat' || !j.e.c) return
    const c = j.e.c
    if (K.fini(c)) return termine(j)

    j.e.attente = Math.max(0, j.e.attente - dt)
    if (j.e.attente > 0) return

    const u = K.actif(c)
    if (!u || K.estOperateur(c, u)) return
    K.ouvreTour(c, u)
    K.recharge(u)
    IA.tourProcessus(c, u)
    IA.annonce(c)
    j.son.casse(3)
    j.e.attente = 0.55
    sauve(j)
  },

  quitte: (j) => sauve(j),

  dessine(j, ctx) {
    const e = j.e
    if (e.vue === 'titre') e.zones = VM.titre(ctx, e.meta, e.equipage)
    else if (e.vue === 'recrutement') e.zones = VM.recrutement(ctx, e.offertes, e.prises, e.equipage)
    else if (e.vue === 'carte') e.zones = ecranCarte(ctx, e)
    else if (e.vue === 'equipe') e.zones = VE.dessine(ctx, e.p, e.sel, e.detail)
    else if (e.vue === 'noeud') e.zones = VM.noeud(ctx, e.p, E.rencontre(e.p), E.noeudCourant(e.p))
    else if (e.vue === 'butin') e.zones = VM.butin(ctx, e.p, e.p.offre, e.jette)
    else if (e.vue === 'fardeau') e.zones = VM.fardeau(ctx, e.p, e.offreF)
    else if (e.vue === 'bilan') e.zones = VM.bilan(ctx, e.p, e.gagne)
    else {
      VC.dessine(j, ctx, e.c, e.choisie)
      VC.journal(ctx, e.c)
      e.zones = VC.zones(e.c, e.choisie)
    }
  },

  appui(j, p) {
    const e = j.e
    const z = e.zones.find((x) => p.x >= x.x && p.x <= x.x + x.w && p.y >= x.y && p.y <= x.y + x.h)
    if (!z) return
    const suites = {
      equipage: () => ((e.equipage = z.n), j.son.clic()),
      plonger: () => commencePartie(j, 'campagne'),
      infini: () => commencePartie(j, 'infini'),
      fardeau: () => prendFardeau(j, z.id),
      classe: () => choisitClasse(j, z.id),
      partir: () => entre(j),
      engager: () => engage(j),
      prend: () => prendComp(j, z.id),
      jette: () => jetteComp(j, z.k),
      annule: () => ((e.jette = null), j.son.clic()),
      passer: () => (avance(j), j.son.clic()),
      suite: () => (avance(j), j.son.clic()),
      fin: () => rejoue(j),
      comp: () => (e.vue === 'equipe' ? lit(j, 'comp', z.k) : choisitComp(j, z.k)),
      cible: () => frappe(j, z.cible),
      noeud: () => ((e.choisi = { couche: z.couche, k: z.k }), j.son.clic()),
      descendre: () => descend(j),
      equipe: () => ((e.vue = 'equipe'), (e.detail = null), j.son.clic()),
      retour: () => ((e.vue = 'carte'), j.son.clic()),
      op: () => ((e.sel = z.k), (e.detail = null), j.son.clic()),
      mod: () => lit(j, 'mod', z.k),
      rang: () => bascule(j),
    }
    suites[z.quoi]?.()
  },
}

// --- Enchaînement des écrans ------------------------------------------------------------

function commencePartie(j, mode = 'campagne') {
  j.son.niveau()
  j.e.mode = mode
  j.e.graine = (j.hasard() * 4294967296) >>> 0
  j.e.offertes = E.classesOffertes(j.e.graine)
  j.e.prises = []
  j.e.vue = 'recrutement'
}

function choisitClasse(j, id) {
  const pris = j.e.prises
  const combien = j.e.equipage ?? 3
  const k = pris.indexOf(id)
  if (k >= 0) pris.splice(k, 1)
  else if (pris.length < combien) pris.push(id)
  else if (combien === 1) {
    // Seul, un deuxième appui remplace le choix au lieu de le refuser : on
    // n'oblige pas à désélectionner avant de changer d'avis.
    pris[0] = id
  } else return j.son.rate()
  j.son.clic()
}

function entre(j) {
  j.e.p = E.nouvelle(j.e.graine, j.e.prises, j.e.mode ?? 'campagne')
  j.e.vue = 'carte'
  j.e.choisi = null
  j.e.meta.plongees++
  ecritMeta(j.e.meta)
  j.son.niveau()
  sauve(j)
}

function engage(j) {
  const e = j.e
  const n = E.noeudCourant(e.p)
  if (n.type === 'archive' || n.type === 'marche') {
    e.p.offre = E.offre(e.p, n.type === 'marche' ? 'module' : 'comp')
    if (!e.p.offre) return avance(j)
    e.jette = null
    e.vue = 'butin'
    return j.son.clic()
  }
  if (n.type === 'atelier') {
    for (const o of e.p.equipe) o.pv = Math.min(o.pvMax, o.pv + Math.round(o.pvMax * 0.3))
    j.son.record()
    j.fx.eclat(180, 300, C.vert, { n: 26, vitesse: 200 })
    return avance(j)
  }
  e.c = K.commence(e.p.equipe, E.rencontre(e.p))
  if (e.p.mode === 'infini') SF.applique(e.c, e.p.fardeaux)
  IA.annonce(e.c)
  e.choisie = null
  e.attente = 0.4
  e.vue = 'combat'
  j.son.niveau()
  sauve(j)
}

function prendComp(j, id) {
  const e = j.e
  const op = e.p.equipe[e.p.offre.op]
  if (e.p.offre.quoi === 'module') {
    if (op.mod.indexOf(null) < 0) {
      e.jette = id
      return j.son.clic()
    }
    E.prendModule(e.p, e.p.offre, id)
    j.son.record()
    return avance(j)
  }
  if (E.librePour(op) < 0) {
    // Plus de place : il faut choisir ce qu'on sacrifie, tout de suite.
    e.jette = id
    return j.son.clic()
  }
  E.prend(e.p, e.p.offre, id)
  j.son.record()
  avance(j)
}

function jetteComp(j, k) {
  const e = j.e
  const ok =
    e.p.offre.quoi === 'module' ? E.prendModule(e.p, e.p.offre, e.jette, k) : E.prend(e.p, e.p.offre, e.jette, k)
  if (!ok) return j.son.rate()
  j.son.record()
  e.jette = null
  avance(j)
}

/** Fin d'un nœud : on remonte à la carte, ou on passe à l'acte suivant. */
function avance(j) {
  const e = j.e
  e.p.offre = null
  e.c = null
  e.choisi = null

  if (E.finActe(e.p)) {
    if (E.acteSuivant(e.p) === 'fin') {
      // Le noyau est tombé : la campagne a une vraie fin, et elle ouvre la
      // descente sans fin. C'est ce que le mode INFINI vient récompenser.
      e.gagne = true
      e.p.fini = true
      e.meta.victoires++
      if (E.estSeul(e.p)) e.meta.victoiresSeul = (e.meta.victoiresSeul ?? 0) + 1
      ecritMeta(e.meta)
      j.efface()
      return j.perdu()
    }
    j.fx.eclat(180, 300, C.accent, { n: 36, vitesse: 260 })
    j.son.record()
    if (E.doitChoisirFardeau(e.p)) {
      e.offreF = SF.offreFardeaux(e.p.graine, e.p.acte, e.p.fardeaux)
      e.vue = 'fardeau'
      return sauve(j)
    }
  }
  e.vue = 'carte'
  sauve(j)
}

function prendFardeau(j, id) {
  const e = j.e
  if (!e.offreF?.includes(id)) return j.son.rate()
  e.p.fardeaux.push(id)
  e.offreF = null
  e.vue = 'carte'
  j.son.record()
  j.fx.secoue(8)
  sauve(j)
}

function ecranCarte(ctx, e) {
  const carte = E.carteDe(e.p)
  const zones = VK.dessine(ctx, carte, e.p.position, e.p.visites, e.choisi)
  const apercu = e.choisi
    ? Carte.rencontre(
        e.p.graine,
        e.p.acte,
        e.choisi.couche,
        e.choisi.k,
        carte.couches[e.choisi.couche][e.choisi.k].type,
      ).map((id) => PROC[id].nom)
    : []
  const type = e.choisi ? carte.couches[e.choisi.couche][e.choisi.k].type : null
  VK.panneau(ctx, carte, e.choisi, type === 'processus' || type === 'elite' || type === 'noyau' ? apercu : [])
  return [...zones, ...VK.boutons(ctx, !!e.choisi)]
}

function descend(j) {
  const e = j.e
  if (!e.choisi) return j.son.rate()
  E.descend(e.p, e.choisi.couche, e.choisi.k)
  e.choisi = null
  e.vue = 'noeud'
  j.son.clic()
  sauve(j)
}

function lit(j, quoi, k) {
  const e = j.e
  e.detail = e.detail?.quoi === quoi && e.detail.k === k ? null : { quoi, k }
  j.son.clic()
}

function bascule(j) {
  const op = j.e.p.equipe[j.e.sel]
  op.rang = op.rang === 0 ? 1 : 0
  j.son.clic()
  sauve(j)
}

// --- Le combat ----------------------------------------------------------------------------

function choisitComp(j, k) {
  const e = j.e
  const u = K.actif(e.c)
  if (!u || !K.estOperateur(e.c, u)) return
  const comp = COMP[u.comp[k]]
  if (!comp) return j.son.rate()

  // Deuxième appui sur la même carte : on valide sur la cible par défaut. Le
  // cas courant ne demande jamais d'aller toucher le haut de l'écran, ce qui
  // est pénible à une main sur un grand téléphone.
  if (e.choisie === k) {
    const legales = K.cibles(e.c, u, comp)
    if (!K.jouable(e.c, u, comp, k) || !legales.length) {
      e.choisie = null
      return j.son.rate()
    }
    return frappe(j, defaut(e.c, comp, legales), k)
  }
  if (!K.jouable(e.c, u, comp, k)) return j.son.rate()
  const legales = K.cibles(e.c, u, comp)
  j.son.clic()
  // Une seule cible possible : on saute l'étape du ciblage.
  if (legales.length === 1) return frappe(j, legales[0], k)
  e.choisie = k
}

const defaut = (c, comp, legales) =>
  comp.soin || comp.forme === 'allie' || comp.forme === 'soi'
    ? legales.reduce((a, b) => (a.pv / a.pvMax <= b.pv / b.pvMax ? a : b))
    : legales.reduce((a, b) => (a.pv <= b.pv ? a : b))

function frappe(j, cible, indice) {
  const e = j.e
  const u = K.actif(e.c)
  const k = indice ?? e.choisie
  if (k == null || !u || !K.estOperateur(e.c, u)) return
  K.ouvreTour(e.c, u)
  K.recharge(u)
  const r = K.joue(e.c, u, k, cible)
  e.choisie = null
  IA.annonce(e.c)

  const somme = r.coups.reduce((s, x) => s + (x.degats ?? 0), 0)
  if (somme > 0) {
    j.son.casse(Math.min(11, 3 + Math.floor(somme / 8)))
    j.fx.secoue(r.prime ? 7 : 3)
    const b = K.estOperateur(e.c, cible) ? VC.placeOp(e.c.ops.indexOf(cible)) : VC.placeProc(e.c, cible)
    j.fx.bulle(b.x + b.w / 2, b.y - 4, '−' + somme, r.prime ? C.vert : C.accent, r.prime ? 19 : 15)
  } else j.son.clic()
  if (r.repere) {
    j.son.rate()
    j.fx.secoue(11)
  }
  e.attente = 0.35
  sauve(j)
}

function termine(j) {
  const e = j.e
  const issue = K.fini(e.c)
  // L'intégrité restante est conservée d'un combat à l'autre : c'est ce qui
  // fait qu'un combat gagné de justesse coûte quelque chose.
  e.c.ops.forEach((o, i) => (e.p.equipe[i].pv = o.pv))
  e.c = null
  e.p.combat = null

  if (issue === 'perdu') {
    // Une défaite termine la partie. Sans prix à l'échec, la progression n'en a
    // aucun — c'est exactement ce qui rendait ASCENSION creux.
    e.gagne = false
    e.vue = 'bilan'
    if (e.p.mode === 'infini') {
      const cle = E.estSeul(e.p) ? 'profondeurSeul' : 'profondeur'
      if (e.p.acte > (e.meta[cle] ?? 0)) {
        e.meta[cle] = e.p.acte
        ecritMeta(e.meta)
      }
    }
    j.efface()
    j.son.mort()
    return
  }
  e.gagne = true
  e.vue = 'bilan'
  j.son.record()
  sauve(j)
}

function rejoue(j) {
  j.e.p = null
  j.e.c = null
  j.e.vue = 'titre'
  j.e.meta = litMeta()
  j.son.clic()
}

function sauve(j) {
  if (!j.e.p) return
  j.e.p.combat = j.e.c
  j.sauve(E.sauvegarde(j.e.p))
  j.e.p.combat = null
}
