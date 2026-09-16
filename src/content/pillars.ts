import { z } from 'zod'

/**
 * Content for the selectable pillars.
 *
 * Deliberately separate from `experience.ts`, which is a flat CV list used for
 * the résumé-shaped view. What a pillar needs is different: companies that hold
 * several roles, and each role broken into a handful of short titled cards
 * rather than one paragraph. Pasting six bullets on screen is what this
 * structure exists to prevent — a card cannot hold a paragraph, so the shape of
 * the data enforces the shape of the design.
 */

const cardSchema = z.object({
  /** Short all-caps label: SCOPE, PRODUCT, OWNERSHIP, IMPACT, BUILT, STACK. */
  label: z.string().min(1).max(14),
  /** One or two sentences. Long enough to say something, short enough to scan. */
  body: z.string().min(1).max(260),
})

const roleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  /** Display string exactly as it should read, e.g. "May 2026 – Aug 2026". */
  period: z.string().min(1),
  /** One line under the title, before the cards. */
  summary: z.string().min(1).max(200),
  cards: z.array(cardSchema).min(1).max(6),
  /** Chips under the cards. Keep to the things worth naming. */
  stack: z.array(z.string()).default([]),
})

const companySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  location: z.string().min(1),
  /** Span across every role held there, e.g. "Jan 2026 – Aug 2026". */
  period: z.string().min(1),
  /**
   * The lead company on the pillar gets more room and is opened by default.
   * Exactly one company per pillar may claim it.
   */
  lead: z.boolean().default(false),
  /** Reverse chronological. The first entry is the most recent position. */
  roles: z.array(roleSchema).min(1),
})

export type PillarCard = z.infer<typeof cardSchema>
export type PillarRole = z.infer<typeof roleSchema>
export type PillarCompany = z.infer<typeof companySchema>

/** PILLAR 01 — EXPERIENCE I. */
export const experiencePillar: PillarCompany[] = [
  {
    id: 'volaris',
    name: 'VOLARIS GROUP',
    location: 'Waterloo, ON',
    period: 'Jan 2026 – Aug 2026',
    lead: true,
    roles: [
      {
        id: 'project-manager',
        title: 'PROJECT MANAGER',
        period: 'May 2026 – Aug 2026',
        summary: 'Owned an AI maturity assessment platform end to end, across seven portfolio companies.',
        cards: [
          {
            label: 'SCOPE',
            body: 'Led product strategy and rollout of the AI maturity assessment platform across 7 portfolio companies.',
          },
          {
            label: 'OWNERSHIP',
            body: 'Owned the roadmap, feature prioritization, client onboarding and demos, iterating on what users actually reported back.',
          },
          {
            label: 'PRODUCT',
            body: 'Worked directly with portfolio companies to turn stakeholder needs into product improvements, spanning engineering, AI, infrastructure, UX and business requirements.',
          },
          {
            label: 'IMPACT',
            body: 'Drove the product out of development and into active portfolio use. Sole engineer and PM on an enterprise Learning Tool, deployed on Azure Container Apps with PITR disaster recovery and zero-downtime releases.',
          },
        ],
        stack: ['Azure Container Apps', 'PITR', 'Zero-downtime deploys'],
      },
      {
        id: 'ai-software-engineer',
        title: 'AI SOFTWARE ENGINEER',
        period: 'Jan 2026 – May 2026',
        summary: 'Built the enterprise AI platforms the product work above was later shaped around.',
        cards: [
          {
            label: 'BUILT',
            body: 'Architected an enterprise Legal Document Analysis platform: document extraction, validation, contract risk identification, multilingual translation and role-based access.',
          },
          {
            label: 'BUILT',
            body: 'Built a multimodal AI maturity assessment platform supporting realtime voice, text chat and document upload, scoring responses across 7 maturity dimensions into structured results.',
          },
          {
            label: 'ARCHITECTURE',
            body: 'Legal platform deployed on Azure Kubernetes Service; assessment workflows orchestrated with Temporal.',
          },
          {
            label: 'IMPACT',
            body: 'Cut AI response times from roughly 10–15 seconds to under 3.',
          },
        ],
        stack: ['Azure OpenAI', 'Temporal', 'Supabase / PostgreSQL', 'React', 'AKS'],
      },
    ],
  },
  {
    id: 'danier',
    name: 'DANIER',
    location: 'Toronto, ON',
    period: 'May 2025 – Aug 2025',
    lead: false,
    roles: [
      {
        id: 'software-developer',
        title: 'SOFTWARE DEVELOPER',
        period: 'May 2025 – Aug 2025',
        summary: 'A retail AI assistant, and the inventory automation behind it.',
        cards: [
          {
            label: 'BUILT',
            body: 'A custom AI shopping assistant with product search, caching and analytics.',
          },
          {
            label: 'AUTOMATION',
            body: 'Automated inventory monitoring with low-stock email alerting.',
          },
          {
            label: 'STACK',
            body: 'FastAPI and React with Tailwind on the front; Python, SQLAlchemy, Pandas and OpenPyXL behind it.',
          },
        ],
        stack: ['FastAPI', 'React', 'Tailwind', 'SQLAlchemy', 'Pandas', 'OpenPyXL'],
      },
    ],
  },
].map((c) => companySchema.parse(c))
