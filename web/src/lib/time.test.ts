import { describe, expect, it } from 'vitest'
import { axisFor, formatRange, formatTime, freeGaps, toMinutes, weekdayOf } from './time'

describe('freeGaps', () => {
  it('returns gaps between classes, not before the first or after the last', () => {
    expect(freeGaps([[540, 590], [660, 740], [900, 980]], 30)).toEqual([
      [590, 660],
      [740, 900],
    ])
  })

  it('skips gaps shorter than the minimum', () => {
    expect(freeGaps([[540, 590], [600, 650]], 30)).toEqual([])
  })

  it('counts a gap of exactly the minimum', () => {
    expect(freeGaps([[540, 590], [620, 650]], 30)).toEqual([[590, 620]])
  })

  it('handles overlapping and unsorted classes', () => {
    expect(freeGaps([[700, 800], [540, 720], [600, 650]], 30)).toEqual([])
    expect(freeGaps([[900, 950], [540, 600]], 30)).toEqual([[600, 900]])
  })

  it('returns nothing for zero or one class', () => {
    expect(freeGaps([], 30)).toEqual([])
    expect(freeGaps([[540, 600]], 30)).toEqual([])
  })
})

describe('formatting', () => {
  it('reads API times as minutes', () => {
    expect(toMinutes('09:30:00')).toBe(570)
    expect(toMinutes('00:00:00')).toBe(0)
  })

  it('formats times on a 12-hour clock', () => {
    expect(formatTime(0)).toBe('12:00am')
    expect(formatTime(720)).toBe('12:00pm')
    expect(formatTime(810)).toBe('1:30pm')
  })

  it('writes am/pm once unless the range crosses noon', () => {
    expect(formatRange(570, 650)).toBe('9:30–10:50am')
    expect(formatRange(660, 740)).toBe('11:00am–12:20pm')
    expect(formatRange(810, 890)).toBe('1:30–2:50pm')
  })
})

describe('weekdayOf', () => {
  it('counts from Monday', () => {
    expect(weekdayOf(new Date(2026, 10, 9))).toBe(0)
    expect(weekdayOf(new Date(2026, 10, 15))).toBe(6)
  })
})

describe('axisFor', () => {
  it('defaults to 8am to 10pm', () => {
    expect(axisFor([])).toEqual([480, 1320])
    expect(axisFor([[540, 600]])).toEqual([480, 1320])
  })

  it('widens to the hour around classes outside the day', () => {
    expect(axisFor([[450, 520], [1300, 1350]])).toEqual([420, 1380])
  })
})
