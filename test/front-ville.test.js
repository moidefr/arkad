/**
 * LA VILLE — l'horloge, les vivres, le moral et les bâtiments.
 *
 * C'est une économie, et une économie se mesure. Le premier réglage payait les
 * vivres sur un stock de vingt rations : la compagnie était affamée au
 * cinquième jour et son moral tombait de 70 à 10 en dix. Rien de tout ça ne se
 * voyait à la lecture.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as C from '../src/massif/front/compagnie.js'
import * as V from '../src/massif/front/ville.js'
import * as U from '../src/massif/front/unites.js'

const neuve = () => C.nouvelle(4242)

// --- L'horloge et les vivres -----------------------------------------------------

test('une compagnie neuve a une ville, et de quoi tenir un mois', () => {
  const c = neuve()
  assert.equal(c.ville.jour, 1)
  assert.equal(c.ville.moral, V.MORAL_DEPART)
  // Le point de réglage qui compte : flâner doit se sentir sur une saison, pas
  // sur une semaine.
  assert.ok(V.joursTenables(c) >= 25, `seulement ${V.joursTenables(c)} jours tenables`)
})

test('un jour coûte de l’or, et rien d’autre', () => {
  const c = neuve()
  const or = c.or
  const b = V.passeJour(c)
  assert.ok(b.mange)
  assert.equal(c.or, or - b.paye)
  assert.equal(c.ville.jour, 2)
})

test('deux semaines au chaud n’entament pas le moral si on peut payer', () => {
  const c = neuve()
  const b = V.passeJours(c, 14)
  assert.equal(b.jeune, 0, 'la compagnie a sauté des repas alors qu’il restait de l’or')
  assert.equal(c.ville.moral, V.MORAL_DEPART, 'le moral a bougé sans raison')
})

test('une caisse vide entame le moral, doucement', () => {
  const c = neuve()
  c.or = 0
  const avant = c.ville.moral
  V.passeJours(c, 5)
  assert.ok(c.ville.moral < avant, 'la disette ne se voit nulle part')
  // Doucement : une caisse vide est déjà une punition, on n'en rajoute pas.
  assert.ok(c.ville.moral > avant - 25, `le moral s’effondre : ${avant} → ${c.ville.moral}`)
})

test('au-delà d’un mois sans combattre, la réputation s’effrite', () => {
  const c = neuve()
  c.renom = 100
  c.or = 100000
  V.passeJours(c, V.JOURS_AVANT_OUBLI)
  assert.equal(c.renom, 100, 'la réputation baisse avant le délai')
  V.passeJours(c, 40)
  assert.ok(c.renom < 100, 'la réputation ne baisse jamais')
  assert.ok(c.renom > 40, `elle s’effondre au lieu de s’effriter : ${c.renom}`)
})

test('se battre remet le compteur d’oubli à zéro', () => {
  const c = neuve()
  c.or = 100000
  V.passeJours(c, 50)
  const avant = c.renom
  c.ville.dernierCombat = c.ville.jour
  c.renom = 100
  V.passeJours(c, 20)
  assert.equal(c.renom, 100, 'le compteur d’oubli n’a pas été remis à zéro')
  assert.ok(avant >= 0)
})

// --- Les bâtiments -----------------------------------------------------------------

test('un bâtiment demande un rang et de l’or, et plafonne', () => {
  const c = neuve()
  c.or = 1000000
  c.niveau = 20
  for (const b of V.BATIMENTS) {
    for (let i = 0; i < V.NIVEAU_MAX; i++) assert.ok(V.construit(c, b.id), `${b.id} niveau ${i + 1}`)
    assert.equal(V.niveauBat(c, b.id), V.NIVEAU_MAX)
    assert.equal(V.construit(c, b.id), false, `${b.id} dépasse son plafond`)
  }
})

test('on ne construit pas ce que le rang n’autorise pas', () => {
  const c = neuve()
  c.or = 1000000
  c.niveau = 1
  const tardif = V.BATIMENTS.find((b) => b.rang > 1)
  assert.equal(V.construit(c, tardif.id), false)
})

test('l’infirmerie soigne chaque jour, sans rien coûter de plus', () => {
  const c = neuve()
  c.or = 100000
  c.ville.bat.infirmerie = 3
  const u = c.troupes[0]
  u.pv = 1
  const or = c.or
  const b = V.passeJours(c, 6)
  assert.ok(u.pv > 1, 'le blessé n’a pas été soigné')
  assert.ok(b.soignes > 0)
  // Le seul or dépensé est celui des jours, pas un supplément de soin.
  assert.equal(or - c.or, V.coutJour(c) * 6)
})

test('la caserne fait progresser la réserve, et elle seule', () => {
  const c = neuve()
  c.or = 100000
  c.ville.bat.caserne = 3
  c.niveau = 12
  // Une troupe alignée et une en réserve, au même niveau de départ.
  const aligne = c.troupes[0]
  const garde = U.creeGenerique('piquier', 1, 'RESERVE', 'R')
  c.troupes.push(garde)
  assert.ok(C.escouadeDe(c, aligne.id), 'la troupe témoin n’est pas alignée')
  assert.ok(!C.escouadeDe(c, garde.id), 'la troupe de réserve est alignée')

  const xpAligne = aligne.xp
  V.passeJours(c, 20)
  assert.ok(garde.xp > 0 || garde.niv > 1, 'la réserve ne progresse toujours pas')
  assert.equal(aligne.xp, xpAligne, 'la caserne entraîne aussi les alignés')
})

test('sans caserne, la réserve ne progresse pas', () => {
  const c = neuve()
  c.or = 100000
  const garde = U.creeGenerique('piquier', 1, 'RESERVE', 'R')
  c.troupes.push(garde)
  V.passeJours(c, 20)
  assert.equal(garde.xp, 0)
})

test('la taverne remonte le moral, et il plafonne', () => {
  const c = neuve()
  c.or = 100000
  c.ville.bat.taverne = 3
  c.ville.moral = 20
  V.passeJours(c, 30)
  assert.equal(c.ville.moral, V.MORAL_MAX, 'le moral ne monte pas jusqu’au plafond')
  V.passeJours(c, 10)
  assert.equal(c.ville.moral, V.MORAL_MAX, 'le moral dépasse son plafond')
})

test('le grenier rend les jours moins chers', () => {
  const c = neuve()
  const plein = V.coutJour(c)
  c.ville.bat.grenier = 3
  assert.ok(V.coutJour(c) < plein, 'le grenier ne sert à rien')
  assert.ok(V.coutJour(c) >= 1, 'le grenier rend les vivres gratuites')
})

// --- Les sessions ------------------------------------------------------------------

test('une session d’entraînement coûte des jours, de l’or, et fait progresser tout le monde', () => {
  const c = neuve()
  c.or = 100000
  c.ville.bat.caserne = 3
  c.niveau = 12
  const jour = c.ville.jour
  const avant = c.troupes.map((u) => u.xp + u.niv * 1000)
  const b = V.entraine(c, 'exercice')
  assert.ok(b, 'la session n’a pas eu lieu')
  assert.equal(c.ville.jour, jour + b.session.jours)
  assert.ok(
    c.troupes.every((u, i) => u.xp + u.niv * 1000 > avant[i]),
    'une troupe n’a rien appris',
  )
})

test('une session qu’on ne peut pas nourrir jusqu’au bout n’est pas proposée', () => {
  const c = neuve()
  c.ville.bat.caserne = 3
  const s = V.SESSIONS[2]
  c.or = s.prix
  assert.equal(V.entraine(c, s.id), null, 'on est parti en manœuvres sans de quoi tenir')
})

test('les sessions s’ouvrent avec le niveau de la caserne', () => {
  const c = neuve()
  c.or = 100000
  c.ville.bat.caserne = 1
  assert.ok(V.sessionOuverte(c, V.SESSIONS[0]))
  assert.equal(V.sessionOuverte(c, V.SESSIONS[2]), false)
  c.ville.bat.caserne = 3
  assert.ok(V.sessionOuverte(c, V.SESSIONS[2]))
})

// --- Le moral en bataille -----------------------------------------------------------

test('le moral de la ville entre en bataille, sans la décider', () => {
  const c = neuve()
  c.ville.moral = V.MORAL_MAX
  const haut = V.bonusMoral(c)
  c.ville.moral = 0
  const bas = V.bonusMoral(c)
  assert.ok(haut > 0 && bas < 0, `${bas} … ${haut}`)
  // L'échelle reste courte : une compagnie démoralisée part avec un handicap,
  // elle ne part pas battue.
  assert.ok(haut <= 12 && bas >= -14, `échelle trop large : ${bas} … ${haut}`)
})

test('une sauvegarde d’avant la ville en reçoit une', () => {
  const c = neuve()
  delete c.ville
  V.cale(c)
  assert.equal(c.ville.jour, 1)
  assert.equal(c.ville.moral, V.MORAL_DEPART)
  assert.deepEqual(c.ville.bat, {})
})
