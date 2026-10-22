import type { LessonBlock, Level, Skill, SkillTrack } from '@/domain/types'

/**
 * The club's skill progression. Coaches tick skills off on the water; parents
 * see progress at home. Clubs can edit this list in the real product.
 */

export const TRACKS: Record<SkillTrack, { name: string; short: string; levels: Level[]; next?: string }> = {
  lts: { name: 'Learn to Sail', short: 'Learn to Sail', levels: ['learn-to-sail'], next: 'Opti Green' },
  green: { name: 'Opti Green Fleet', short: 'Green', levels: ['opti-green'], next: 'Opti Red, White & Blue' },
  champ: { name: 'Opti Red, White & Blue', short: 'Championship', levels: ['opti-red', 'opti-white', 'opti-blue'], next: 'Club 420 or ILCA' },
  c420: { name: 'Club 420', short: '420', levels: ['club-420'], next: 'High school and junior circuit' },
  ilca: { name: 'ILCA', short: 'ILCA', levels: ['ilca'], next: 'ILCA 6 and junior circuit' },
}

export function trackFor(level: Level): SkillTrack {
  return (Object.keys(TRACKS) as SkillTrack[]).find((t) => TRACKS[t].levels.includes(level)) ?? 'lts'
}

const s = (track: SkillTrack, n: number, area: Skill['area'], name: string, detail: string): Skill => ({
  id: `${track}-${n}`,
  track,
  area,
  name,
  detail,
})

export const SKILLS: Skill[] = [
  // Learn to Sail
  s('lts', 1, 'Safety', 'Life jacket on and fitted', 'Puts on their own life jacket, buckles it and passes the shoulder-lift check.'),
  s('lts', 2, 'Rigging', 'Rigs and de-rigs an Opti', 'Steps the mast, ties on the sail, attaches sheet, rudder and daggerboard with a buddy.'),
  s('lts', 3, 'Safety', 'Rights a capsized boat', 'Swims to the daggerboard, rights the boat and climbs back in from the stern.'),
  s('lts', 4, 'Boat handling', 'Steers with the tiller', 'Knows push the tiller away to turn toward the wind, pull to turn away.'),
  s('lts', 5, 'Boat handling', 'Stops the boat', 'Lets the sail out to slow down and stop near a mark or the dock.'),
  s('lts', 6, 'Boat handling', 'Tacks through the wind', 'Turns through the wind, ducks the boom and switches sides with the tiller behind them.'),
  s('lts', 7, 'Boat handling', 'Knows the points of sail', 'Can point to close-hauled, reach and run, and trims the sail for each.'),
  s('lts', 8, 'Rigging', 'Ties a bowline and cleat hitch', 'Ties both without help and uses them to tie up at the dock.'),
  // Green fleet
  s('green', 1, 'Boat handling', 'Sails upwind close-hauled', 'Holds a close-hauled course using the telltales without pinching or stalling.'),
  s('green', 2, 'Boat handling', 'Gybes under control', 'Calls the gybe, guides the boom across and steers straight out of it.'),
  s('green', 3, 'Racing', 'Sails a full triangle course', 'Rounds every mark in order and finishes without coach help.'),
  s('green', 4, 'Racing', 'Times a start', 'Is near the line and moving when the start signal goes.'),
  s('green', 5, 'Rules', 'Port and starboard', 'Knows a starboard-tack boat has right of way and keeps clear on port.'),
  s('green', 6, 'Racing', 'Rounds marks the right way', 'Leaves marks to the correct side and gives room at the mark.'),
  s('green', 7, 'Boat handling', 'Hikes and keeps the boat flat', 'Moves weight to keep the boat flat as the breeze builds.'),
  s('green', 8, 'Safety', 'Sails in 12+ knots', 'Stays in control and recovers on their own in a breezy practice.'),
  // Championship fleet
  s('champ', 1, 'Boat handling', 'Roll tacks', 'Uses body weight to roll the boat through the tack and exit at full speed.'),
  s('champ', 2, 'Boat handling', 'Roll gybes', 'Rolls the boat through the gybe and flattens on the new side.'),
  s('champ', 3, 'Racing', 'Picks the favored end', 'Checks the line by going head-to-wind and starts at the favored end.'),
  s('champ', 4, 'Racing', 'Accelerates off the line', 'Holds position, then accelerates in the last 5 seconds without being over.'),
  s('champ', 5, 'Racing', 'Tacks on headers', 'Reads shifts with a compass or landmarks and tacks on the headers.'),
  s('champ', 6, 'Boat handling', 'Sails by the lee downwind', 'Sails a fast by-the-lee angle downwind and heats up in waves.'),
  s('champ', 7, 'Racing', 'Wide-and-tight roundings', 'Enters marks wide and exits tight, ready to point on the next leg.'),
  s('champ', 8, 'Rules', 'Mark-room and overlaps', 'Explains when mark-room applies at the zone and handles overlaps calmly.'),
  // Club 420
  s('c420', 1, 'Boat handling', 'Skipper–crew calls', 'Skipper and crew use the same short calls for tacks, gybes and puffs.'),
  s('c420', 2, 'Boat handling', 'Spinnaker set and douse', 'Sets and douses the spinnaker cleanly at the windward and leeward marks.'),
  s('c420', 3, 'Boat handling', 'Trapezes upwind', 'Crew trapezes in breeze and moves in and out smoothly through puffs.'),
  s('c420', 4, 'Boat handling', 'Doublehanded roll tack', 'Both sailors time the roll and the crew trims the jib out of the tack.'),
  s('c420', 5, 'Boat handling', 'Jib trim by telltales', 'Crew trims the jib to the telltales and calls changes in pressure.'),
  s('c420', 6, 'Boat handling', 'Spinnaker gybe', 'Gybes the spinnaker without collapsing it or losing the pole.'),
  s('c420', 7, 'Safety', 'Rights a 420 with a crew', 'Rights the boat from a turtle with the crew, then sails away.'),
  s('c420', 8, 'Rigging', 'Rig check before launch', 'Checks shrouds, pins, trapeze wires and lines before every launch.'),
  // ILCA
  s('ilca', 1, 'Rigging', 'Uses the sail controls', 'Sets cunningham, outhaul and vang for the wind before each leg.'),
  s('ilca', 2, 'Boat handling', 'Hikes hard upwind', 'Holds a straight-leg hike through a full beat.'),
  s('ilca', 3, 'Boat handling', 'Surfs waves downwind', 'Steers to catch waves and keeps the boat on a plane.'),
  s('ilca', 4, 'Rules', 'Knows the kinetics rule', 'Can explain what pumping and rocking are allowed and when.'),
  s('ilca', 5, 'Boat handling', 'Tacks in breeze', 'Tacks in 15+ knots without stalling or capsizing.'),
  s('ilca', 6, 'Boat handling', 'Gybes in breeze', 'Gybes in 15+ knots with the mainsheet under control.'),
  s('ilca', 7, 'Racing', 'Covers and splits', 'Chooses when to cover a boat behind and when to split from the fleet.'),
  s('ilca', 8, 'Safety', 'Self-rescue in breeze', 'Rights the boat quickly and sails on without coach help in a breeze.'),
]

export const skillById = new Map(SKILLS.map((k) => [k.id, k]))

/** Ready-made practice plans a coach can start from. */
export const LESSON_LIBRARY: { id: string; title: string; focus: string; tracks: SkillTrack[]; skillIds: string[]; blocks: LessonBlock[] }[] = [
  {
    id: 'starts',
    title: 'Starting practice',
    focus: 'Line sights, timing and acceleration',
    tracks: ['green', 'champ', 'c420', 'ilca'],
    skillIds: ['green-4', 'champ-3', 'champ-4'],
    blocks: [
      { minutes: 10, title: 'Dock talk', detail: 'Wind direction, today’s line, how to take a line sight.' },
      { minutes: 15, title: 'Hold and accelerate', detail: 'Hold position for 30 seconds on the whistle, then accelerate for 5.' },
      { minutes: 25, title: '2-minute starts', detail: 'Six short starts with a single beat to a mark. Call the favored end each time.' },
      { minutes: 30, title: 'Short races', detail: 'Windward-leeward, two laps. Coach boat calls premature starters.' },
      { minutes: 10, title: 'Debrief', detail: 'Each sailor names one start that worked and why.' },
    ],
  },
  {
    id: 'marks',
    title: 'Mark roundings',
    focus: 'Wide-and-tight, mark-room, exits',
    tracks: ['green', 'champ', 'c420'],
    skillIds: ['green-6', 'champ-7', 'champ-8'],
    blocks: [
      { minutes: 10, title: 'Dock talk', detail: 'Draw the wide-and-tight path. Review the zone and mark-room.' },
      { minutes: 20, title: 'Rounding circuit', detail: 'Two marks close together. Round in a line, then in pairs.' },
      { minutes: 25, title: 'Follow the leader', detail: 'Leader picks the rounding; the rest copy the path.' },
      { minutes: 25, title: 'Short-course races', detail: 'Tight course so the fleet arrives at the marks together.' },
      { minutes: 10, title: 'Debrief' },
    ],
  },
  {
    id: 'breeze',
    title: 'Breeze day boat handling',
    focus: 'Hiking, tacks and gybes in 12+ knots',
    tracks: ['green', 'champ', 'c420', 'ilca'],
    skillIds: ['green-7', 'green-8', 'champ-1', 'champ-2', 'ilca-5', 'ilca-6'],
    blocks: [
      { minutes: 10, title: 'Dock talk', detail: 'Safety plan, buddy pairs, capsize procedure.' },
      { minutes: 20, title: 'Upwind hiking', detail: 'Long beat with coach calls on flat boats.' },
      { minutes: 25, title: 'Tack and gybe sets', detail: 'Sets of five on the whistle, rest between sets.' },
      { minutes: 25, title: 'Reaching races', detail: 'Short reaches to keep everyone close to the coach boats.' },
      { minutes: 10, title: 'Debrief' },
    ],
  },
  {
    id: 'light',
    title: 'Light air speed',
    focus: 'Weight placement, smooth steering, patience',
    tracks: ['green', 'champ', 'ilca'],
    skillIds: ['green-1', 'champ-5'],
    blocks: [
      { minutes: 10, title: 'Dock talk', detail: 'Heel to leeward, sit forward, small tiller movements.' },
      { minutes: 25, title: 'Speed tuning in pairs', detail: 'Two boats line up; swap one setting at a time.' },
      { minutes: 25, title: 'Shift game', detail: 'Coach calls the compass number; tack when it’s a header.' },
      { minutes: 25, title: 'Long-course race' },
      { minutes: 10, title: 'Debrief' },
    ],
  },
  {
    id: 'basics',
    title: 'First sails',
    focus: 'Steering, stopping and tacking',
    tracks: ['lts'],
    skillIds: ['lts-4', 'lts-5', 'lts-6'],
    blocks: [
      { minutes: 15, title: 'Dock talk and rigging', detail: 'Rig in pairs. Points of sail on the whiteboard.' },
      { minutes: 20, title: 'Follow the coach boat', detail: 'Reach back and forth; practice stopping at the coach boat.' },
      { minutes: 25, title: 'Tacking game', detail: 'Tack around two buoys, everyone calls "ready about".' },
      { minutes: 15, title: 'Capsize practice', detail: 'Everyone capsizes and rights the boat once near the dock.' },
      { minutes: 15, title: 'De-rig and debrief' },
    ],
  },
  {
    id: 'rules',
    title: 'Rules on the water',
    focus: 'Port-starboard, windward-leeward, mark-room',
    tracks: ['green', 'champ', 'c420', 'ilca'],
    skillIds: ['green-5', 'champ-8', 'ilca-4'],
    blocks: [
      { minutes: 15, title: 'Dock talk', detail: 'Three rules, three diagrams.' },
      { minutes: 25, title: 'Crossing drill', detail: 'Pairs meet on opposite tacks; port boat ducks or tacks.' },
      { minutes: 25, title: 'Umpired races', detail: 'Coach whistles a foul; the sailor does a turn.' },
      { minutes: 15, title: 'Debrief', detail: 'Which call surprised you?' },
    ],
  },
]
