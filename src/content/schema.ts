import { z } from 'zod'

/**
 * Content is validated at module load, which means a malformed entry fails the
 * build rather than rendering an empty pillar in production.
 */

export const roleSchema = z.object({
  org: z.string().min(1),
  title: z.string().min(1),
  location: z.string().min(1),
  /** ISO year-month, e.g. "2026-01". */
  start: z.string().regex(/^\d{4}-\d{2}$/),
  /** null means present. */
  end: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  blurb: z.string().min(1),
})

export const projectSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** One line. Etched on the pillar face, so it must stay short. */
  blurb: z.string().min(1).max(90),
  body: z.string().min(1),
  stack: z.array(z.string()),
  /** Rendered as an etched band near the pillar's base. */
  accolade: z.string().optional(),
  repo: z.string().url().optional(),
  live: z.string().url().optional(),
  year: z.number().int().min(2000).max(2100),
})

export const profileSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  education: z.string().min(1),
  status: z.string().min(1),
  about: z.array(z.string().min(1)),
  email: z.string().email(),
  socials: z.array(z.object({ label: z.string(), href: z.string().url() })),
  stack: z.array(z.string()),
  builds: z.array(z.string()),
})

export type Role = z.infer<typeof roleSchema>
export type Project = z.infer<typeof projectSchema>
export type Profile = z.infer<typeof profileSchema>
