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
export type { Profile, Role, Project } from './schema'

/** The four section monoliths of World 1, in fixed compass order. */
export const SECTIONS = ['about', 'experience', 'writing', 'contact'] as const
export type SectionId = (typeof SECTIONS)[number]

export const SECTION_LABEL: Record<SectionId, string> = {
  about: 'ABOUT',
  experience: 'EXPERIENCE',
  writing: 'WRITING',
  contact: 'CONTACT',
}
