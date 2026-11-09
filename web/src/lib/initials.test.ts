import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(initials('Leo M.')).toBe('LM')
    expect(initials('Maya Rose Chen')).toBe('MC')
  })

  it('handles single names, lowercase, and extra spaces', () => {
    expect(initials('christianh9')).toBe('C')
    expect(initials('  jordan   t  ')).toBe('JT')
  })

  it('returns nothing for an empty name', () => {
    expect(initials('   ')).toBe('')
  })
})
