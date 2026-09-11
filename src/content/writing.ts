import { z } from 'zod'

const postSchema = z.object({
  title: z.string().min(1),
  blurb: z.string().min(1),
  href: z.string().url(),
  date: z.string().regex(/^\d{4}-\d{2}$/),
})

export type Post = z.infer<typeof postSchema>

/**
 * Posts live wherever they are published; this is only the index. Empty is a
 * valid state — the WRITING monolith renders a placeholder rather than
 * disappearing, because a missing monolith would break the array's symmetry.
 */
export const writing: Post[] = [].map((p) => postSchema.parse(p))
