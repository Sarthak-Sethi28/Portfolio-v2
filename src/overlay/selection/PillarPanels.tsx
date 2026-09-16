'use client'

import { experienceI, experienceII } from '@/content'
import { ExperiencePanel } from './ExperiencePanel'
import { WaterlooPanel } from './WaterlooPanel'
import { ContactPanel } from './ContactPanel'

/**
 * All four monuments' content, mounted together.
 *
 * Each panel is hidden until its own column is chosen, so only one can ever be
 * on screen — and because they are all mounted from the start, the first
 * selection does not pay for a mount, a layout and a font in the same frame the
 * column begins to rise.
 */
export function PillarPanels() {
  return (
    <>
      <ExperiencePanel section="experience-i" companies={experienceI} />
      <ExperiencePanel section="experience-ii" companies={experienceII} />
      <WaterlooPanel />
      <ContactPanel />
    </>
  )
}
