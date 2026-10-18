import { describe, expect, it } from 'vitest'
import { EXERCISES } from './exercises'
import { MOTIONS } from '../motion/motions'
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
