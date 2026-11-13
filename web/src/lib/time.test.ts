import { describe, expect, it } from 'vitest'
import {
  axisFor,
  dateInputValue,
  dayHeading,
  formatDuration,
  formatRange,
  formatTime,
  freeGaps,
  freeWindows,
  minutesOf,
  parseWindow,
  toMinutes,
  weekdayOf,
  type Range,
} from './time'

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

describe('match windows', () => {
  it('parses the API window format', () => {
    expect(parseWindow('10:00-12:00')).toEqual([600, 720])
    expect(parseWindow('13:30-14:05')).toEqual([810, 845])
  })

  it('formats durations without zero parts', () => {
    expect(formatDuration(45)).toBe('45m')
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(90)).toBe('1h 30m')
  })
})

describe('dates', () => {
  const now = new Date(2026, 10, 8, 22, 30)

  it('labels today and tomorrow by calendar day, not 24 hours', () => {
    expect(dayHeading(new Date(2026, 10, 8, 23, 59), now)).toBe('Today')
    expect(dayHeading(new Date(2026, 10, 9, 0, 15), now)).toBe('Tomorrow')
  })

  it('names later days with the date', () => {
    expect(dayHeading(new Date(2026, 10, 11, 15, 30), now)).toBe('Wednesday, Nov 11')
  })

  it('reads local minutes and date input values', () => {
    expect(minutesOf(new Date(2026, 10, 11, 15, 30))).toBe(930)
    expect(dateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('freeWindows', () => {
  it('matches freeGaps without hours', () => {
    const classes: Range[] = [[540, 600], [840, 900]]
    expect(freeWindows(classes, null, 30)).toEqual(freeGaps(classes, 30))
  })

  it('counts time before the first and after the last class', () => {
    expect(freeWindows([[540, 600], [840, 900]], [480, 1020], 30)).toEqual([
      [480, 540],
      [600, 840],
      [900, 1020],
    ])
  })

  it('uses the whole window with no classes', () => {
    expect(freeWindows([], [600, 720], 30)).toEqual([[600, 720]])
  })

  it('ignores classes outside the window and short pieces', () => {
    expect(freeWindows([[420, 470], [1100, 1150]], [480, 600], 30)).toEqual([[480, 600]])
    expect(freeWindows([[500, 600]], [480, 700], 30)).toEqual([[600, 700]])
  })
})
