'use client'

import { experienceI, experienceII } from '@/content'
import { NIGHT_PILLARS } from '@/content/nightPillars'
import { useScene } from '@/store/scene'
import { ExperiencePanel } from './ExperiencePanel'
import { WaterlooPanel } from './WaterlooPanel'
import { ContactPanel } from './ContactPanel'
import { ProjectsPanel } from './ProjectsPanel'

/**
 * All four monuments' content, mounted together.
 *
 * Each panel is hidden until its own column is chosen, so only one can ever be
 * on screen — and because they are all mounted from the start, the first
 * selection does not pay for a mount, a layout and a font in the same frame the
 * column begins to rise.
 */
export function PillarPanels() {
  const night = useScene((s) => s.night)

  /*
   * The same four columns, a different subject after the crossing.
   *
   * Day and night content are never mounted together: swapping on `night`
   * rather than hiding one behind the other means a project panel can never be
   * one stale boolean away from appearing over the daylight world.
   */
  if (night) {
    return (
      <>
        <ProjectsPanel section="experience-i" projects={NIGHT_PILLARS['experience-i'].projects} />
        <ProjectsPanel section="experience-ii" projects={NIGHT_PILLARS['experience-ii'].projects} />
        <ProjectsPanel section="waterloo" projects={NIGHT_PILLARS.waterloo.projects} />
        <ProjectsPanel section="contact" projects={NIGHT_PILLARS.contact.projects} />
      </>
    )
  }

  return (
    <>
      <ExperiencePanel section="experience-i" companies={experienceI} />
      <ExperiencePanel section="experience-ii" companies={experienceII} />
      <WaterlooPanel />
      <ContactPanel />
    </>
  )
}
