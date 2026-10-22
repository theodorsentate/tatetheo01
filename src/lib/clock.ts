/**
 * The demo runs on a fixed day so every visit shows a live camp day:
 * Wednesday of week 5 of summer camps. Time moves forward in real time from
 * the moment the page loads, starting mid-morning (AM groups on the water) or
 * early afternoon (PM groups), whichever the demo menu picks.
 *
 * In the real product this module is replaced by `() => new Date()`.
 */

export const DEMO_DAY = '2027-07-14'
export const DEMO_TIMES = {
  morning: { label: 'Morning', hhmm: '10:20', hint: 'AM groups on the water' },
  afternoon: { label: 'Afternoon', hhmm: '13:40', hint: 'PM groups on the water' },
} as const
export type DemoTime = keyof typeof DEMO_TIMES

const KEY = 'burgee-demo-time'
function savedTime(): DemoTime {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'afternoon' ? 'afternoon' : 'morning'
  } catch {
    return 'morning'
  }
}
let current: DemoTime = typeof window === 'undefined' ? 'morning' : savedTime()
let base = new Date(`${DEMO_DAY}T${DEMO_TIMES[current].hhmm}:00`).getTime()
let loadedAt = Date.now()
const listeners = new Set<() => void>()

/** The current time inside the demo. Use this everywhere instead of `new Date()`. */
export function now(): Date {
  return new Date(base + (Date.now() - loadedAt))
}

/** The demo moment a given demo time starts at (used to build the seed). */
export function demoStart(time: DemoTime = 'morning'): Date {
  return new Date(`${DEMO_DAY}T${DEMO_TIMES[time].hhmm}:00`)
}

export function demoTime(): DemoTime {
  return current
}

export function setDemoTime(time: DemoTime) {
  current = time
  base = demoStart(time).getTime()
  loadedAt = Date.now()
  try {
    window.localStorage.setItem(KEY, time)
  } catch {
    /* private mode: the choice lasts until reload */
  }
  listeners.forEach((fn) => fn())
}

export function subscribeClock(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
