/**
 * Les règles de BRÈCHE, au point près.
 *
 * Le jeu est simple à décrire et plein de cas limites : une ligne et une
 * colonne qui se croisent, une bombe prise dans une ligne qui en déclenche une
 * autre, une roche qui encaisse au lieu de partir, une main dont plus rien ne
 * rentre. Chacun est monté à la main et comparé à un nombre exact.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import * as L from '../src/long/breche/logique.js'
import { PIECES, PIECE, MONDES, TRANSFOS, TRANSFO, REGLES, EFFETS, encombrement, bassinDe } from '../src/long/breche/donnees.js'

/** Un plateau vide, à la taille voulue, sans passer par la génération d'un monde. */
function plateau(taille = 8) {
  const p = L.nouvelle(1)
  p.taille = taille
  p.cases = new Array(taille * taille).fill(0)
  p.spec = new Array(taille * taille).fill('')
  p.gel = new Array(taille * taille).fill(0)
  p.n = 0
  p.score = 0
  p.combo = 0
  p.fini = false
  return p
}

const remplis = (p, cases) => {
  for (const [c, l] of cases) p.cases[L.indice(p, c, l)] = 1
}
const compte = (p) => p.cases.filter((x) => x > 0).length

// --- Les tables --------------------------------------------------------------

test('chaque pièce est cohérente, et aucune n’est en double', () => {
  const vus = new Set()
  const formes = new Set()
  for (const piece of PIECES) {
    assert.ok(!vus.has(piece.id), 'pièce en double : ' + piece.id)
    vus.add(piece.id)
    assert.ok(piece.nom && piece.poids > 0, piece.id)
    assert.ok(piece.cases.length >= 1 && piece.cases.length <= 9, piece.id)
    const { w, h } = encombrement(piece)
    assert.ok(w <= 5 && h <= 5, `${piece.id} fait ${w}×${h}, trop gros pour la plus petite grille`)
    // Une pièce doit toucher les deux bords de son encombrement, sinon elle
    // porte un décalage invisible qui fausse le centrage à l'écran.
    assert.ok(piece.cases.some((c) => c[0] === 0) && piece.cases.some((c) => c[1] === 0), `${piece.id} n’est pas calée en haut à gauche`)
    const forme = piece.cases
      .map((c) => c.join(','))
      .sort()
      .join(' ')
    assert.ok(!formes.has(forme), `deux pièces ont exactement la même forme : ${piece.id}`)
    formes.add(forme)
  }
})

test('chaque monde ne parle que le vocabulaire de règles admis', () => {
  const vus = new Set()
  for (const m of MONDES) {
    assert.ok(!vus.has(m.id), 'monde en double : ' + m.id)
    vus.add(m.id)
    assert.ok(m.nom && m.texte?.length > 20 && m.objectif > 0, m.id)
    for (const cle of Object.keys(m.regles)) assert.ok(REGLES.includes(cle), `${m.id} : règle inconnue « ${cle} »`)
    for (const id of Object.keys(m.regles.semis ?? {})) assert.ok(TRANSFO[id], `${m.id} : semis d’une transformation inconnue`)
    const t = m.regles.taille ?? 8
    assert.ok(t >= 8 && t <= 10, `${m.id} : grille de ${t}`)
    assert.ok(bassinDe(m.regles).length >= 10, `${m.id} : vivier de pièces trop maigre`)
  }
})

test('aucune règle de monde n’est décorative', async () => {
  const { readFile } = await import('node:fs/promises')
  const lus = await Promise.all(
    ['logique.js', 'donnees.js'].map((f) => readFile(new URL('../src/long/breche/' + f, import.meta.url), 'utf8')),
  )
  const src = lus.join('\n')
  for (const cle of REGLES) {
    assert.ok(src.includes(`.${cle}`), `la règle « ${cle} » n’est lue nulle part`)
    assert.ok(MONDES.some((m) => m.regles[cle] != null), `la règle « ${cle} » n’est utilisée par aucun monde`)
  }
  for (const t of TRANSFOS) {
    assert.ok(EFFETS.includes(t.effet), `${t.id} : effet hors vocabulaire`)
    assert.ok(src.includes(`'${t.effet}'`), `${t.id} : l’effet « ${t.effet} » n’est appliqué nulle part`)
  }
})

// --- Poser -------------------------------------------------------------------

test('une pièce ne rentre ni sur une case prise ni hors de la grille', () => {
  const p = plateau(8)
  remplis(p, [[3, 3]])
  assert.equal(L.peutPoser(p, 'carre2', 2, 2), false, 'elle recouvre une case prise')
  assert.equal(L.peutPoser(p, 'carre2', 0, 0), true)
  assert.equal(L.peutPoser(p, 'cinq_h', 4, 0), false, 'elle sort à droite')
  assert.equal(L.peutPoser(p, 'cinq_h', 3, 0), true)
  assert.equal(L.peutPoser(p, 'cinq_v', 0, 4), false, 'elle sort en bas')
})

test('poser retire la pièce de la main et remplit exactement ses cases', () => {
  const p = plateau(8)
  p.main = ['carre2', 'unite', 'duo_h']
  const r = L.pose(p, 0, 1, 1)
  assert.ok(r)
  assert.equal(p.main[0], null)
  assert.equal(compte(p), 4)
  for (const [c, l] of [[1, 1], [2, 1], [1, 2], [2, 2]]) assert.ok(L.pleine(p, c, l))
  assert.equal(r.points, 4, 'quatre cases posées, quatre points')
})

test('une ligne pleine éclate, et rien d’autre', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 3]])
  remplis(p, [[0, 5]])
  p.main = ['unite', null, null]
  const r = L.pose(p, 0, 7, 3)
  assert.equal(r.lignes, 1)
  assert.equal(r.colonnes, 0)
  assert.equal(compte(p), 1, 'la ligne est partie, le bloc isolé reste')
  assert.ok(L.pleine(p, 0, 5))
})

test('une ligne et une colonne qui se croisent comptent deux fois, pas trois', () => {
  const p = plateau(8)
  for (let c = 0; c < 8; c++) if (c !== 4) remplis(p, [[c, 4]])
  for (let l = 0; l < 8; l++) if (l !== 4) remplis(p, [[4, l]])
  p.main = ['unite', null, null]
  const r = L.pose(p, 0, 4, 4)
  assert.equal(r.lignes, 1)
  assert.equal(r.colonnes, 1)
  assert.equal(compte(p), 0, 'la croix entière est partie')
  // Quinze cases posées d'avance plus une : le point de croisement ne doit pas
  // être compté deux fois dans ce qui est emporté.
  assert.equal(new Set(r.emportees).size, 15)
})

test('la chaîne monte tant qu’on éclate, et retombe dès qu’on ne le fait plus', () => {
  const p = plateau(8)
  p.main = ['unite', 'unite', 'unite']
  for (let c = 0; c < 7; c++) remplis(p, [[c, 0]])
  assert.equal(L.pose(p, 0, 7, 0).combo, 0)
  assert.equal(p.combo, 1)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 1]])
  assert.equal(L.pose(p, 1, 7, 1).combo, 1, 'le deuxième éclat profite de la chaîne')
  assert.equal(p.combo, 2)
  L.pose(p, 2, 0, 5)
  assert.equal(p.combo, 0, 'une pose sans éclat casse la chaîne')
})

test('deux lignes d’un coup rapportent plus que deux fois une ligne', () => {
  const seule = L.points(1, 8, 0)
  const double = L.points(2, 8, 0)
  assert.ok(double > seule * 2, `${double} contre ${seule * 2}`)
  assert.ok(L.points(1, 8, 4) > L.points(1, 8, 0), 'la chaîne ne rapporte rien')
  assert.equal(L.points(0, 8, 3), 0)
})

// --- Les transformations -------------------------------------------------------

test('une bombe prise dans une ligne emporte ses voisines', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 4]])
  p.spec[L.indice(p, 3, 4)] = 'bombe'
  remplis(p, [[3, 3], [3, 5], [2, 3]])
  p.main = ['unite', null, null]
  L.pose(p, 0, 7, 4)
  assert.equal(L.pleine(p, 3, 3), false, 'la case au-dessus de la bombe a survécu')
  assert.equal(L.pleine(p, 3, 5), false)
  assert.equal(L.pleine(p, 2, 3), false)
})

test('un rayon emporte toute sa ligne et toute sa colonne', () => {
  const p = plateau(8)
  for (let c = 0; c < 7; c++) remplis(p, [[c, 2]])
  p.spec[L.indice(p, 5, 2)] = 'rayon'
  for (let l = 0; l < 8; l++) remplis(p, [[5, l]])
  p.main = ['unite', null, null]
  L.pose(p, 0, 7, 2)
  for (let l = 0; l < 8; l++) assert.equal(L.pleine(p, 5, l), false, `la colonne du rayon tient encore en ${l}`)
})

test('une roche encaisse le premier éclat et part au second', () => {
  const p = plateau(8)
  const pose = () => {
    for (let c = 0; c < 7; c++) remplis(p, [[c, 6]])
    p.main = ['unite', null, null]
    L.pose(p, 0, 7, 6)
  }
  remplis(p, [[3, 6]])
  p.spec[L.indice(p, 3, 6)] = 'roche'
  p.gel[L.indice(p, 3, 6)] = 1
  pose()
  assert.ok(L.pleine(p, 3, 6), 'la roche est partie du premier coup')
  assert.equal(p.spec[L.indice(p, 3, 6)], '', 'elle n’est plus une roche après avoir encaissé')
  pose()
  assert.equal(L.pleine(p, 3, 6), false, 'la roche a tenu deux éclats')
})

test('un lingot rapporte plus qu’un bloc ordinaire', () => {
  const monte = (avec) => {
    const p = plateau(8)
    for (let c = 0; c < 7; c++) remplis(p, [[c, 1]])
    if (avec) p.spec[L.indice(p, 2, 1)] = 'lingot'
    p.main = ['unite', null, null]
    return L.pose(p, 0, 7, 1).points
  }
  assert.ok(monte(true) > monte(false))
})

// --- La fin, les outils, la progression ------------------------------------------

test('la partie s’arrête quand plus aucune pièce ne rentre', () => {
  const p = plateau(8)
  for (let i = 0; i < p.cases.length; i++) p.cases[i] = 1
  p.cases[0] = 0
  p.main = ['carre2', 'carre2', 'carre2']
  assert.equal(L.bloque(p), true)
  p.main = ['unite', null, null]
  assert.equal(L.bloque(p), false, 'une case libre laisse encore passer l’unité')
})

test('une main neuve contient toujours au moins une pièce jouable', () => {
  for (let g = 0; g < 60; g++) {
    const p = L.nouvelle(g * 977)
    // On bouche presque tout, en laissant deux cases isolées.
    for (let i = 0; i < p.cases.length; i++) p.cases[i] = 1
    p.cases[0] = 0
    p.cases[p.cases.length - 1] = 0
    L.tireMain(p)
    assert.ok(!L.bloque(p), `graine ${g} : main morte sur un plateau qui a encore de la place`)
  }
})

test('le marteau enlève une case, et seulement si on en a un', () => {
  const p = plateau(8)
  remplis(p, [[2, 2]])
  p.outils.marteau = 1
  assert.equal(L.marteau(p, 5, 5), false, 'on ne martèle pas le vide')
  assert.equal(L.marteau(p, 2, 2), true)
  assert.equal(compte(p), 0)
  assert.equal(p.outils.marteau, 0)
  remplis(p, [[3, 3]])
  assert.equal(L.marteau(p, 3, 3), false, 'sans marteau, rien')
})

test('l’échange change la main sans avancer la crue', () => {
  const p = L.nouvelle(11)
  p.outils.echange = 1
  const avant = [...p.main]
  const poses = p.poses
  assert.ok(L.echange(p))
  assert.notDeepEqual(p.main, avant)
  assert.equal(p.poses, poses, 'l’échange a fait avancer le compteur de poses')
  assert.equal(L.echange(p), false)
})

test('la crue pousse tout vers le haut, et un doublé la repousse', () => {
  const p = L.nouvelle(3)
  L.entreMonde(p, MONDES.findIndex((m) => m.regles.montee))
  const pas = L.regles(p).montee
  assert.ok(pas > 0)
  // On pose jusqu'à la montée, sans jamais éclater.
  let garde = 0
  while ((p.depuisMontee ?? 0) < pas - 1 && garde++ < 400) {
    const k = p.main.findIndex((id) => id && L.placeExiste(p, id))
    if (k < 0) break
    const id = p.main[k]
    let pose = false
    for (let l = 0; l < p.taille && !pose; l++) {
      for (let c = 0; c < p.taille && !pose; c++) if (L.peutPoser(p, id, c, l)) pose = !!L.pose(p, k, c, l)
    }
    if (!pose) break
  }
  const avant = p.montees ?? 0
  assert.ok(p.depuisMontee >= 0)
  // Et le compteur retombe sur un doublé : c'est la seule prise du joueur sur
  // ce monde.
  p.depuisMontee = pas - 1
  assert.equal(L.REPOUSSE, 2)
})

test('franchir un objectif remet le score à zéro mais pas le total', () => {
  const p = L.nouvelle(5)
  p.score = L.objectif(p) + 10
  const total = p.total
  assert.ok(L.atteint(p))
  assert.ok(L.suivant(p))
  assert.equal(p.n, 1)
  assert.equal(p.score, 0)
  assert.equal(p.total, total, 'le total a été remis à zéro avec le score')
  assert.equal(L.suivant(p), false, 'on passe un monde sans avoir atteint l’objectif')
})

test('les mondes se suivent, puis recommencent un cran plus haut', () => {
  const premier = L.mondeDe(0)
  const cycle = L.mondeDe(MONDES.length)
  assert.equal(cycle.id, premier.id)
  assert.ok(cycle.objectif > premier.objectif, 'le second cycle n’est pas plus dur')
  assert.ok(cycle.nom !== premier.nom, 'rien ne distingue le second cycle du premier')
  assert.ok((cycle.regles.prerempli ?? 0) > (premier.regles.prerempli ?? 0))
})

// --- Sauvegarde et parties entières ---------------------------------------------------

test('la sauvegarde se relit à l’identique', () => {
  const p = L.nouvelle(77)
  p.main = ['carre2', 'unite', 'duo_h']
  L.pose(p, 0, 0, 0)
  const relu = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(p))))
  assert.ok(relu)
  assert.deepEqual(relu.cases, p.cases)
  assert.deepEqual(relu.main, p.main)
  assert.equal(relu.total, p.total)
  assert.equal(L.migre({ v: 999 }), null)
  assert.equal(L.migre(null), null)
})

test('le tirage est reproductible : fermer l’application ne change pas la main', () => {
  const a = L.nouvelle(1234)
  const b = L.migre(JSON.parse(JSON.stringify(L.sauvegarde(a))))
  a.main = [null, null, null]
  b.main = [null, null, null]
  L.tireMain(a)
  L.tireMain(b)
  assert.deepEqual(a.main, b.main)
})

test('deux cents parties automatiques : aucune ne casse un invariant', () => {
  let finies = 0
  let mondes = 0
  for (let g = 0; g < 200; g++) {
    const p = L.nouvelle(g * 5081 + 3)
    let coups = 0
    while (!p.fini && coups < 400) {
      const k = p.main.findIndex((id) => id && L.placeExiste(p, id))
      if (k < 0) break
      const id = p.main[k]
      let pose = false
      for (let l = 0; l < p.taille && !pose; l++) {
        for (let c = 0; c < p.taille && !pose; c++) if (L.peutPoser(p, id, c, l)) pose = !!L.pose(p, k, c, l)
      }
      if (!pose) break
      coups++
      if (L.atteint(p)) {
        mondes++
        L.suivant(p)
      }
      assert.equal(p.cases.length, p.taille * p.taille, 'la grille a changé de taille toute seule')
      assert.ok(p.score >= 0 && p.total >= 0)
      assert.ok(p.main.length === L.EN_MAIN)
      for (const i of p.cases) assert.ok(i >= 0 && i <= 5, 'teinte de bloc hors palette')
      for (const s of p.spec) assert.ok(s === '' || TRANSFO[s], 'transformation inconnue sur la grille')
    }
    if (p.fini) finies++
  }
  assert.ok(finies > 150, `seulement ${finies} parties sur 200 se terminent`)
  assert.ok(mondes > 0, 'aucun monde franchi en deux cents parties')
})
