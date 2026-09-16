/**
 * The single entry point for all site content.
 *
 * Every consumer in world/ and overlay/ imports from here and nowhere else.
 * That indirection is what would make a future CMS swap a change to this one
 * module rather than a change everywhere.
 */
export { profile } from './profile'
export { experience } from './experience'
export { projects } from './projects'
export * from './pillars'
export type { Profile, Role, Project } from './schema'

/**
 * The four monuments, in the order they are numbered.
 *
 * The number is a fact about the CONTENT, not about where the column happens to
 * stand — 01 is Experience I wherever the layout puts it — so the index in this
 * array is the number, and the ring simply takes them in order.
 */
export const SECTIONS = ['experience-i', 'experience-ii', 'waterloo', 'contact'] as const
export type SectionId = (typeof SECTIONS)[number]

export const SECTION_LABEL: Record<SectionId, string> = {
  'experience-i': 'EXPERIENCE I',
  'experience-ii': 'EXPERIENCE II',
  waterloo: 'WATERLOO',
  contact: 'CONTACT',
}

/** Two digits, as shown on the hover label: 01 / EXPERIENCE I. */
export function sectionNumber(id: SectionId): string {
  return String(SECTIONS.indexOf(id) + 1).padStart(2, '0')
}
