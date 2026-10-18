import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exercises'
import { MOTIONS } from '../motion/motions'
import { EXERCISEDB_IDS } from './exercisedb'
import { VIDEOS } from './videos'

describe('preset videos', () => {
  it('cover every exercise with a valid YouTube id', () => {
    for (const e of EXERCISES) {
      expect(VIDEOS[e.id]?.id, e.id).toMatch(/^[\w-]{11}$/)
    }
  })
})

describe('motion demos', () => {
  it('exist for every exercise', () => {
    for (const e of EXERCISES) expect(MOTIONS[e.id], e.id).toBeDefined()
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
