// SERVER ONLY. What the objects in shared/objects.js mean. Games build their prompts
// and answers from these, so nothing here is ever sent to a client.

// Categories. `yes` objects clearly belong; `maybe` objects are arguable, so a game
// never puts them on screen while asking about that category: a player must never
// lose time to a judgement call (spec §1, Fairness). Every other object clearly
// doesn't belong. `things` and `one` are phrases games build prompts from.
export const CATEGORIES = {
  wear: {
    yes: ['boot', 'crown', 'hat', 'sock', 'shirt'],
    maybe: ['umbrella'],
    things: 'things you could wear',
    one: 'something you could wear',
    label: ['could wear', 'couldn’t wear'],
  },
  eat: {
    yes: ['apple', 'banana', 'icecream'],
    maybe: ['fish', 'mushroom', 'cactus', 'leaf', 'tree', 'bird'],
    things: 'things you could eat',
    one: 'something you could eat',
    label: ['could eat', 'couldn’t eat'],
  },
  alive: {
    yes: ['fish', 'bird', 'tree', 'cactus'],
    maybe: ['mushroom', 'leaf', 'apple', 'banana'],
    things: 'living things',
    one: 'something alive',
    label: ['alive', 'not alive'],
  },
  fly: {
    yes: ['plane', 'rocket', 'bird'],
    maybe: ['umbrella', 'leaf', 'hat'],
    things: 'things that fly',
    one: 'something that flies',
    label: ['flies', 'doesn’t fly'],
  },
  kitchen: {
    yes: ['spoon', 'fork', 'mug', 'glass'],
    maybe: ['bottle', 'apple', 'banana', 'icecream', 'fish', 'candle', 'chair', 'mushroom', 'bell', 'hammer'],
    things: 'things you’d keep in a kitchen',
    one: 'something you’d keep in a kitchen',
    label: ['kitchen', 'not kitchen'],
  },
  travel: {
    yes: ['car', 'boat', 'plane', 'rocket'],
    maybe: ['chair', 'boot', 'house', 'tent'],
    things: 'things people travel in',
    one: 'something people travel in',
    label: ['travel in it', 'don’t travel in it'],
  },
  drink: {
    yes: ['glass', 'bottle', 'mug'],
    maybe: ['spoon', 'icecream', 'boot', 'hat', 'bell'],
    things: 'things you could drink from',
    one: 'something you could drink from',
    label: ['drink from it', 'can’t drink from it'],
  },
  shelter: {
    yes: ['house', 'tent'],
    maybe: ['car', 'boat', 'plane', 'rocket', 'tree', 'umbrella'],
    things: 'things people sleep inside',
    one: 'something people sleep inside',
    label: ['sleep inside', 'don’t sleep inside'],
  },
  water: {
    yes: ['fish', 'boat'],
    maybe: ['bird', 'bottle', 'leaf', 'glass', 'mug', 'plane', 'boot', 'umbrella'],
    things: 'things that belong on or in water',
    one: 'something that belongs on or in water',
    label: ['on water', 'not on water'],
  },
}

// Everyday real-life size of each object in centimetres (its longest side). Only used
// where items differ by a wide margin (see sizeOrderable), so a person never has to
// split hairs between, say, a sock and a hat.
export const SIZE_CM = {
  key: 6, mushroom: 8, leaf: 8, apple: 8, mug: 10, glass: 12, spoon: 15, candle: 15, icecream: 15,
  fork: 18, pencil: 18, banana: 18, bell: 20, crown: 20, bird: 20, sock: 25, bottle: 25,
  fish: 30, hat: 30, boot: 30, hammer: 30, shirt: 70, umbrella: 90, chair: 90, cactus: 150,
  tent: 200, car: 450, boat: 600, tree: 1000, house: 1200, plane: 4000, rocket: 5000,
}

// Two objects can be put in size order without argument only if one is at least this
// many times the other.
export const SIZE_GAP = 2.5

export const ALL = Object.keys(SIZE_CM)

// Objects that clearly don't belong to a category (neither yes nor maybe).
export const clearlyNot = (category) => ALL.filter((name) => !category.yes.includes(name) && !category.maybe.includes(name))
