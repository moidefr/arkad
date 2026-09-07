/**
 * Le barème, le schéma et les écrans de classement.
 *
 * Trois choses valent d'être prouvées ici, et aucune ne demande de réseau :
 *
 *   — le barème couvre exactement les jeux qui produisent un score, et pas
 *     un de plus (une référence oubliée, c'est un jeu qu'on ne peut pas
 *     classer ; une référence de trop, c'est un jeu fantôme au général) ;
 *   — le SQL versionné dit la même chose que `coefficients.js`, sinon le
 *     serveur compte des points que le client n'annonce pas ;
 *   — les écrans tiennent dans les deux gabarits, comme tous les autres.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { CATEGORIES, TOUS } from '../src/catalogue.js'
import { REFERENCES, PONDERATIONS, BASE, PLAFOND, RETENUS, points, general, classable } from '../src/classement/coefficients.js'
import {
  dispoPodium,
  hauteurPodium,
  dispoOnglets,
  onglet,
  dispoListe,
  ligneListe,
  dispoCompte,
  dispoPodiumClassement,
  messageVide,
} from '../src/classement/ecran.js'
import { dispoAccueil, carteAccueil, dispoFin, dispoPodiumAccueil, dispoPodiumFin, dispoSon } from '../src/engine.js'
import { depuisChemin, cheminClassement } from '../src/route.js'
import { identifiantDe, PSEUDO_VALIDE, SNAP_VALIDE, nettoie } from '../src/classement/compte.js'
import { dessinePodium, dessineLigne } from '../src/classement/ecran.js'
import { schema } from '../outils/schema-supabase.mjs'
import { FORMATS, HUD } from '../src/format.js'
import { fauxCtx, peint } from './faux.js'

const GABARITS = [FORMATS.portrait, FORMATS.paysage]

const dedans = (z, t) => z.x >= 0 && z.y >= HUD - 44 && z.x + z.w <= t.W && z.y + z.h <= t.H
const chevauche = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

// --- Le barème ----------------------------------------------------------------

test('le barème couvre exactement les jeux qui produisent un score', () => {
  for (const jeu of TOUS) {
    if (jeu.sansScore) {
      assert.equal(
        REFERENCES[jeu.id],
        undefined,
        `${jeu.id} n'a pas de score : lui donner une référence classerait un état de partie`,
      )
    } else {
      assert.ok(REFERENCES[jeu.id] > 0, `${jeu.id} produit un score mais n'a pas de référence`)
    }
  }
  // Et pas de référence orpheline : un jeu retiré du catalogue laisserait
  // sinon ses points traîner au général pour toujours.
  const ids = new Set(TOUS.map((j) => j.id))
  for (const id of Object.keys(REFERENCES)) assert.ok(ids.has(id), `référence sans jeu : ${id}`)
})

test('chaque catégorie a une pondération, et le classable suit le catalogue', () => {
  for (const cat of CATEGORIES) assert.ok(PONDERATIONS[cat.id] > 0, `${cat.id} : pas de pondération`)
  for (const jeu of TOUS) assert.equal(classable(jeu), !jeu.sansScore && REFERENCES[jeu.id] !== undefined, jeu.id)
})

test('atteindre la référence vaut le même nombre de points dans tous les jeux', () => {
  // C'est toute la raison d'être du barème : 1000 points normalisés à COURT
  // valent 1000 points normalisés à MOYEN, quels que soient les nombres que
  // les deux jeux affichent à l'écran.
  for (const cat of CATEGORIES) {
    for (const jeu of cat.jeux) {
      if (!classable(jeu)) continue
      assert.equal(points(jeu.id, REFERENCES[jeu.id], cat.id), Math.round(PONDERATIONS[cat.id] * BASE), jeu.id)
      assert.equal(points(jeu.id, REFERENCES[jeu.id] / 2, cat.id), Math.round(PONDERATIONS[cat.id] * BASE * 0.5), jeu.id)
    }
  }
})

test('les points ne récompensent ni le zéro, ni l’inconnu, ni l’infini', () => {
  assert.equal(points('corde', 0, 'court'), 0)
  assert.equal(points('corde', -5, 'court'), 0)
  assert.equal(points('ce-jeu-n-existe-pas', 9999, 'court'), 0)
  assert.equal(points('usine', 9999, 'long'), 0, 'un jeu sansScore ne rapporte rien')
  // Le plafond : un score dix fois au-dessus de la référence ne rapporte pas
  // dix fois plus, sinon un seul record écraserait tout un classement.
  const plafonne = points('corde', REFERENCES.corde * 100, 'court')
  assert.equal(plafonne, Math.round(BASE * PLAFOND))
  assert.equal(points('corde', REFERENCES.corde * 3, 'court'), plafonne, 'au-delà du plafond, rien ne bouge')
})

test('une pondération inconnue ne fait pas exploser le compte', () => {
  assert.equal(points('corde', REFERENCES.corde, 'categorie-inventee'), BASE)
})

test('le général ne retient que les meilleurs jeux, pas l’assiduité', () => {
  const acharne = Array.from({ length: 30 }, () => 100)
  const doue = [900, 900, 900, 900, 900]
  assert.equal(general(doue), 4500)
  assert.equal(general(acharne), 100 * RETENUS, 'jouer à trente jeux ne bat pas jouer bien à cinq')
  assert.ok(general(doue) > general(acharne))
  assert.equal(general([]), 0)
  assert.equal(general([10, 20]), 30, 'moins de cinq jeux comptent quand même')
})

// --- Le schéma ----------------------------------------------------------------

test('le SQL versionné est bien celui que le barème produit', () => {
  // Le serveur recalcule les points ; s'il le fait avec d'autres nombres que
  // le client, deux totaux s'affichent pour une même partie et personne ne
  // sait lequel croire. Régénérer : node outils/schema-supabase.mjs
  const versionne = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8')
  assert.equal(versionne, schema(), 'supabase/schema.sql est périmé — relance outils/schema-supabase.mjs')
})

test('le schéma n’expose aucune écriture directe sur les scores', () => {
  const sql = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8')
  assert.match(sql, /alter table public\.scores enable row level security/)
  assert.match(sql, /create policy "scores lisibles" on public\.scores for select/)
  // Aucune politique d'insertion ou de mise à jour : le seul chemin est
  // poser_score(), qui calcule les points lui-même.
  assert.equal(/create policy[^;]*on public\.scores for (insert|update|delete)/.test(sql), false)
  assert.match(sql, /create or replace function public\.poser_score/)
  // Le Snap n'est publié nulle part : ni la vue par jeu, ni le général.
  const vues = sql.slice(sql.indexOf('create or replace view'))
  assert.equal(vues.includes('snap'), false, 'le Snap ne doit apparaître dans aucun classement')
})

// --- Les comptes --------------------------------------------------------------

test('un pseudo devient un identifiant stable, insensible à la casse', () => {
  assert.equal(identifiantDe('Greg'), 'greg@joueurs.arkad.fr')
  assert.equal(identifiantDe('  greg  '), 'greg@joueurs.arkad.fr', 'un espace collé ne crée pas un second compte')
  assert.equal(identifiantDe('GREG'), identifiantDe('greg'))
  assert.equal(nettoie('  a b  '), 'a b')
})

test('les pseudos et les snaps acceptés sont exactement ceux du schéma', () => {
  const sql = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8')
  assert.ok(sql.includes(PSEUDO_VALIDE.source.replace(/^\^|\$$/g, '')), 'le pseudo n’a pas la même règle des deux côtés')
  assert.ok(sql.includes(SNAP_VALIDE.source.replace(/^\^|\$$/g, '')), 'le snap n’a pas la même règle des deux côtés')
  for (const bon of ['greg', 'Greg_Boulard', 'a-b-c', 'x12']) assert.ok(PSEUDO_VALIDE.test(bon), bon)
  for (const mauvais of ['ab', 'a'.repeat(17), 'greg boulard', 'greg@x', '']) {
    assert.equal(PSEUDO_VALIDE.test(mauvais), false, mauvais)
  }
})

// --- Les écrans ---------------------------------------------------------------

test('le podium a trois marches, le vainqueur au centre et plus haut', () => {
  const m = dispoPodium(20, 100, 320, FORMATS.portrait.W, FORMATS.portrait.H)
  assert.equal(m.length, 3)
  const premier = m.find((z) => z.place === 0)
  const milieu = m[1]
  assert.equal(milieu.place, 0, 'le premier n’est pas au centre')
  for (const z of m) assert.ok(z.h <= premier.h, 'une marche dépasse celle du vainqueur')
  // Toutes les marches finissent au même bas : c'est une estrade, pas un
  // escalier flottant.
  for (const z of m) assert.equal(z.y + z.h, premier.y + premier.h)
  for (const z of m) assert.ok(z.x >= 20 && z.x + z.w <= 340)
  // Couché, il n'y a pas d'estrade : une bande, et `hauteurPodium` le dit.
  assert.equal(dispoPodium(20, 100, 600, FORMATS.paysage.W, FORMATS.paysage.H), null)
  assert.ok(hauteurPodium(640, 360) < hauteurPodium(360, 640))
})

test('le podium tient dans la hauteur que le moteur lui réserve', () => {
  for (const t of GABARITS) {
    const h = hauteurPodium(t.W, t.H)
    const m = dispoPodium(20, 0, t.W - 40, t.W, t.H)
    if (!m) continue
    for (const z of m) assert.ok(z.y + z.h <= h, `${t.W}×${t.H} : une marche dépasse de ${z.y + z.h - h}px`)
  }
})

test('le podium de l’accueil ne recouvre ni les cartes ni le bas de l’écran', () => {
  for (const t of GABARITS) {
    const pod = dispoPodiumAccueil(t.W, t.H)
    assert.ok(pod, `${t.W}×${t.H} : pas de place pour le podium sur l’accueil`)
    assert.ok(dedans(pod, t), `${t.W}×${t.H} : le podium déborde`)
    const d = dispoAccueil(t.W, t.H)
    for (const [i] of CATEGORIES.entries()) {
      assert.ok(!chevauche(pod, carteAccueil(i, d)), `${t.W}×${t.H} : le podium recouvre une carte`)
    }
  }
})

test('le podium de l’écran de fin ne recouvre pas les boutons', () => {
  for (const t of GABARITS) {
    const pod = dispoPodiumFin(t.W, t.H)
    assert.ok(pod, `${t.W}×${t.H} : pas de place pour le top 3 après la partie`)
    assert.ok(dedans(pod, t), `${t.W}×${t.H} : le top 3 déborde`)
    const boutons = dispoFin(t.W, t.H)
    for (const b of boutons) assert.ok(!chevauche(pod, b), `${t.W}×${t.H} : le top 3 recouvre un bouton`)
    // Debout, le titre de l'estrade est écrit au-dessus d'elle : il lui faut
    // sa ligne, sinon « TOP 3 CORDE » vient mordre le bouton QUITTER.
    const bas = boutons[1].y + boutons[1].h
    if (t.W < t.H) assert.ok(pod.y - bas >= 18, `${t.W}×${t.H} : pas la place du titre au-dessus du podium`)
  }
})

test('les onglets, la liste et le bouton de compte tiennent dans les deux formats', () => {
  // Cinq onglets : le général et les quatre catégories, au cas où MASSIF
  // gagne un jour un jeu qui compte des points.
  for (const t of GABARITS) {
    for (const n of [2, 3, 4, 5]) {
      const d = dispoOnglets(t.W, t.H, n)
      const zones = Array.from({ length: n }, (_, i) => onglet(i, d))
      for (const z of zones) {
        assert.ok(z.x >= 0 && z.x + z.w <= t.W, `${t.W}×${t.H} : un onglet déborde`)
        assert.ok(z.w >= 40, `${t.W}×${t.H} : onglet de ${z.w}px, trop étroit`)
      }
      for (let i = 1; i < n; i++) assert.ok(!chevauche(zones[i - 1], zones[i]))
      // Et il reste la place du bouton en haut à droite.
      assert.ok(zones.at(-1).y > dispoSon(t.W).y + dispoSon(t.W).h - 10)
    }

    const compte = dispoCompte(t.W, t.H)
    assert.ok(dedans(compte, t), `${t.W}×${t.H} : le bouton de compte déborde`)
    assert.ok(compte.h >= 28 && compte.w >= 44, `${t.W}×${t.H} : bouton de compte trop petit`)

    for (const avecPodium of [false, true]) {
      const dL = dispoListe(t.W, t.H, { avecPodium })
      assert.ok(dL.max >= 3, `${t.W}×${t.H} : seulement ${dL.max} lignes visibles`)
      // Une ligne de plus que `max` est dessinée pour « ta place à toi » :
      // elle doit rester au-dessus du bouton de compte.
      const derniere = ligneListe(dL.max, dL)
      assert.ok(derniere.y + derniere.h <= compte.y, `${t.W}×${t.H} : la liste passe sous le bouton de compte`)
      // Les onglets, le podium et la liste s'empilent sans se toucher : la
      // liste part de la hauteur réelle du podium, pas d'un nombre écrit à la
      // main qui se décale au premier réglage.
      const dO = dispoOnglets(t.W, t.H, 4)
      const pod = dispoPodiumClassement(t.W, t.H)
      assert.ok(pod.y >= dO.y + dO.h, `${t.W}×${t.H} : le podium remonte sur les onglets`)
      const premiere = ligneListe(0, dL)
      assert.ok(premiere.y >= (avecPodium ? pod.y + pod.h : dO.y + dO.h), `${t.W}×${t.H} : la liste remonte trop haut`)
    }
  }
})

test('rien de ce que le podium peint ne sort de la place qu’on lui donne', () => {
  // Le même faux contexte que les tests d'écran des jeux : on ne peint pas,
  // on enregistre, et on relit. C'est ce qui attrape un pseudo long qui
  // déborde de sa marche — invisible autrement qu'à l'œil, sur un téléphone.
  const lignes = [
    { pseudo: 'GregBoulard_42', points: 128456, score: 999999 },
    { pseudo: 'ab', points: 12, score: 3 },
    { pseudo: 'ÉÈÀÇxyz-_09', points: 7, score: 1 },
  ]
  for (const t of GABARITS) {
    for (const partielles of [lignes, lignes.slice(0, 1), []]) {
      const ctx = fauxCtx()
      const pod = dispoPodiumAccueil(t.W, t.H)
      dessinePodium(ctx, pod.x, pod.y, pod.w, t.W, t.H, partielles, { titre: 'CLASSEMENT GÉNÉRAL' })
      // Les lueurs débordent exprès de quelques pixels : c'est leur métier.
      // Ce qu'on interdit, c'est de sortir de l'écran.
      for (const op of ctx.ops) {
        const r = peint(op)
        if (!r) continue
        assert.ok(r.x >= 0 && r.x + r.w <= t.W, `${t.W}×${t.H} : « ${op.s ?? op.type} » déborde en largeur`)
        assert.ok(r.y + r.h <= t.H, `${t.W}×${t.H} : « ${op.s ?? op.type} » déborde en bas`)
      }
    }
  }
})

test('le texte d’une ligne de classement reste dans sa rangée', () => {
  // Les trois colonnes — rang, pseudo, valeur — ne doivent ni sortir de la
  // rangée ni se marcher dessus. On ne regarde que les textes : la lueur du
  // liseré « c'est toi » déborde exprès, c'est ce qui en fait une lueur.
  for (const t of GABARITS) {
    const d = dispoListe(t.W, t.H, { avecPodium: true })
    const ctx = fauxCtx()
    const z = ligneListe(0, d)
    dessineLigne(ctx, z, { rang: 12, pseudo: 'GregBoulard_1234', valeur: '128456 pts', moi: true })
    const textes = ctx.ops.filter((o) => o.type === 'texte').map(peint)
    assert.equal(textes.length, 3)
    for (const r of textes) {
      assert.ok(r.x >= z.x && r.x + r.w <= z.x + z.w, `${t.W}×${t.H} : un texte sort de la rangée`)
    }
    for (let i = 1; i < textes.length; i++) {
      assert.ok(
        textes[i - 1].x + textes[i - 1].w <= textes[i].x,
        `${t.W}×${t.H} : deux colonnes de la ligne se recouvrent`,
      )
    }
  }
})

test('l’écran vide dit toujours pourquoi il est vide', () => {
  assert.match(messageVide({ charge: false, erreur: null }, true), /hors ligne/)
  assert.equal(messageVide({ charge: false, erreur: 'pas de réseau' }, false), 'pas de réseau')
  assert.match(messageVide({ charge: true, erreur: null }, false), /chargement/)
  assert.match(messageVide({ charge: false, erreur: null }, false), /personne/)
})

// --- L'adresse ----------------------------------------------------------------

test('le classement a une adresse, générale ou centrée sur un jeu', () => {
  assert.deepEqual(depuisChemin('/classement/'), { cat: null, def: null, classement: true, jeu: null })
  const jeu = TOUS.find((j) => classable(j))
  assert.equal(cheminClassement(jeu), `/classement/${jeu.id}/`)
  assert.equal(depuisChemin(cheminClassement(jeu)).jeu, jeu)
  assert.equal(cheminClassement(null), '/classement/')
  // Un jeu inconnu dans l'adresse ramène au général, pas à une page morte.
  assert.equal(depuisChemin('/classement/ce-jeu-n-existe-pas/').jeu, null)
  // Et le classement n'est pas une catégorie : il ne doit pas s'être glissé
  // dans le catalogue.
  assert.equal(CATEGORIES.some((c) => c.id === 'classement'), false)
})
