import { describe, expect, it } from 'vitest'
import { CURATED, EXERCISES } from './exercises'
import { MOTIONS } from '../motion/motions'
import { EDB_CATALOG, EXERCISEDB_IDS } from './exercisedb'
import { VIDEOS } from './videos'

describe('preset videos', () => {
  it('cover every exercise with a valid YouTube id', () => {
    for (const e of CURATED) {
      expect(VIDEOS[e.id]?.id, e.id).toMatch(/^[\w-]{11}$/)
    }
  })
})

describe('motion demos', () => {
  it('exist for every exercise', () => {
    for (const e of CURATED) expect(MOTIONS[e.id], e.id).toBeDefined()
  })
})

describe('ExerciseDB mapping', () => {
  it('only maps known exercises to valid ids', () => {
    const ids = new Set(EXERCISES.map((e) => e.id))
    for (const [k, v] of Object.entries(EXERCISEDB_IDS)) {
      expect(ids.has(k), k).toBe(true)
      expect(v).toMatch(/^[\w]{7}$/)
    }
  })
})

describe('ExerciseDB catalog', () => {
  it('adds the full catalog without duplicating curated exercises', () => {
    const ids = EXERCISES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(EXERCISES.length).toBe(CURATED.length + EDB_CATALOG.length - Object.keys(EXERCISEDB_IDS).length)
    const names = EXERCISES.filter((e) => e.edbId)
    expect(names.every((e) => e.name && e.en && e.primary.length > 0)).toBe(true)
  })
})
