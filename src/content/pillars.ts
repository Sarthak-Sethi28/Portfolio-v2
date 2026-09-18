import { z } from 'zod'

/**
 * Content for the four navigable monuments.
 *
 * Separate from `experience.ts`, which is a flat CV list. What a pillar needs is
 * different: a handful of small titled boxes a recruiter can read in seconds.
 *
 * Each box carries its own substance. The detail used to sit behind a fold, and
 * the honest expectation is that nobody opens a fold — so the box says the
 * headline and then, underneath it, the sentence that would have been hidden.
 * The caps below are what keep that sentence a sentence: `value` is a phrase,
 * `note` is one line, and neither can grow into the paragraph this whole
 * structure exists to prevent.
 */

const cardSchema = z.object({
  /** Small uppercase section label: SCOPE, IMPACT, STACK, BUILT. */
  label: z.string().min(1).max(22),
  /** The headline, as a phrase. Read first, and sometimes read alone. */
  value: z.string().min(1).max(90),
  /** The substance, visible without a click. One sentence. */
  note: z.string().min(1).max(200).optional(),
  /**
   * Set on the one card worth reading from across the room.
   * "7 PORTFOLIO COMPANIES" lands; four equal paragraphs do not.
   */
  metric: z.boolean().default(false),
})

const roleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  period: z.string().min(1),
  where: z.string().min(1),
  cards: z.array(cardSchema).min(1).max(6),
  stack: z.array(z.string()).default([]),
})

const companySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** One line beside the name, e.g. "Co-op · 8 months". */
  kind: z.string().min(1),
  where: z.string().min(1),
  /** Reverse chronological: the first role is the most recent. */
  roles: z.array(roleSchema).min(1),
})

export type PillarCard = z.infer<typeof cardSchema>
export type PillarRole = z.infer<typeof roleSchema>
export type PillarCompany = z.infer<typeof companySchema>

const companies = (list: unknown[]) => list.map((c) => companySchema.parse(c))

/* ------------------------------------------------------------------ 01 */

export const experienceI: PillarCompany[] = companies([
  {
    id: 'volaris',
    name: 'Volaris Group',
    kind: 'Co-op · 8 months',
    where: 'Canada · Remote',
    roles: [
      {
        id: 'project-manager',
        title: 'Project Manager',
        period: 'May 2026 – Aug 2026',
        where: 'Canada · Remote',
        cards: [
          {
            label: 'Scope',
            value: '7 portfolio companies',
            note: 'Led product strategy and rollout of the AI maturity assessment platform across all seven.',
            metric: true,
          },
          {
            label: 'Ownership',
            value: 'Roadmap → rollout → adoption',
            note: 'Owned roadmap, feature prioritization, client onboarding and demos, iterating continuously on real user feedback.',
          },
          {
            label: 'Product',
            value: 'AI Maturity Assessment Platform',
            note: 'Worked directly with portfolio companies to translate stakeholder needs into improvements across engineering, AI, infrastructure, UX and business requirements.',
          },
          {
            label: 'Delivery',
            value: 'Enterprise Learning Tool',
            note: 'Sole engineer and PM. Deployed on Azure Container Apps with automated PITR disaster recovery and zero-downtime deployments.',
          },
        ],
        stack: ['Azure Container Apps', 'PITR', 'Zero-downtime deploys'],
      },
      {
        id: 'ai-software-engineer',
        title: 'AI Software Engineer',
        period: 'Jan 2026 – May 2026',
        where: 'Canada · Remote',
        cards: [
          {
            label: 'Impact',
            value: '10–15s → <3s',
            note: 'Cut AI response time on the assessment platform from roughly 10–15 seconds to under three.',
            metric: true,
          },
          {
            label: 'Built',
            value: 'Legal Document Analysis platform',
            note: 'AI document extraction and validation, contract-risk identification, multilingual translation and role-based access. Deployed on Azure Kubernetes Service.',
          },
          {
            label: 'Platform',
            value: 'Voice · Text · Documents',
            note: 'Multimodal assessment supporting realtime voice conversations, text chat and document uploads, scored across 7 maturity dimensions into structured results.',
          },
          {
            label: 'Architecture',
            value: 'Azure OpenAI · Temporal · PostgreSQL',
            note: 'React front end on Azure cloud infrastructure, with Temporal orchestrating the assessment workflows.',
          },
        ],
        stack: ['Azure OpenAI', 'Temporal', 'Supabase / PostgreSQL', 'React', 'Azure / cloud infrastructure'],
      },
    ],
  },
  {
    id: 'danier',
    name: 'Danier',
    kind: 'Software Developer',
    where: 'Vaughan, Ontario · Hybrid',
    roles: [
      {
        id: 'software-developer',
        title: 'Software Developer',
        period: 'June 2025 – Aug 2025',
        where: 'Vaughan, Ontario · Hybrid',
        cards: [
          {
            label: 'AI Assistant',
            value: 'Product search · answers · analytics',
            note: "Custom AI assistant on Danier's website, helping customers find products and answers to common questions, with caching and analytics behind it.",
          },
          {
            label: 'Inventory automation',
            value: 'Low-stock alerts by email',
            note: 'Tracked low-stock products and sent HTML email alerts to internal stakeholders, removing the need for manual inventory checks.',
          },
          {
            label: 'Stack',
            value: 'FastAPI · React · Tailwind',
            note: 'Python, SQLAlchemy, Pandas and OpenPyXL behind the interface.',
          },
          {
            label: 'E-commerce',
            value: 'On-page SEO',
            note: 'Contributed to on-page SEO across the storefront.',
          },
        ],
        stack: ['Python', 'FastAPI', 'SQLAlchemy', 'Pandas', 'OpenPyXL', 'React', 'Tailwind CSS'],
      },
    ],
  },
])

/* ------------------------------------------------------------------ 02 */

export const experienceII: PillarCompany[] = companies([
  {
    id: 'prompt-capital',
    name: 'Prompt Capital',
    kind: 'Software Engineer · Internship',
    where: 'Delhi, India · On-site',
    roles: [
      {
        id: 'software-engineer',
        title: 'Software Engineer',
        period: 'Jan 2024 – May 2024',
        where: 'Delhi, India · On-site',
        cards: [
          {
            label: 'Healthcare platform',
            value: 'Hospital discovery · emergency · consultations',
            note: 'Developed core features of a healthcare application covering all three flows.',
          },
          {
            label: 'Backend',
            value: 'Python · SQL · data workflows',
            note: 'Built and maintained backend services and the data workflows feeding them.',
          },
          {
            label: 'Cloud',
            value: 'AWS',
            note: 'Deployed and operated the platform on AWS.',
          },
          {
            label: 'Engineering',
            value: 'Debugging · testing · code review',
            note: 'Performance-focused fixes alongside day-to-day testing and review.',
          },
        ],
        stack: ['Python', 'SQL', 'AWS'],
      },
    ],
  },
  {
    id: 'nokia',
    name: 'Nokia',
    kind: 'Research Intern',
    where: 'India · On-site',
    roles: [
      {
        id: 'research-intern',
        title: 'Research Intern',
        period: 'Jun 2023 – Sep 2023',
        where: 'India · On-site',
        cards: [
          {
            label: 'AI',
            value: 'Capabilities, limits, applications',
            note: 'Assessed where current approaches hold up, where they do not, and what they could be used for.',
          },
          {
            label: 'Cloud',
            value: 'Emerging cloud computing',
            note: 'Analyzed technical papers, architectures and industry developments in next-generation computing systems.',
          },
          {
            label: 'Quantum',
            value: 'Classical vs quantum',
            note: 'Compared potential applications across classical and quantum approaches.',
          },
          {
            label: 'Research',
            value: 'Summaries · presentations · trends',
            note: 'Produced technical summaries, research presentations, trend analysis and areas for further study.',
          },
        ],
        stack: [],
      },
    ],
  },
])

/* ------------------------------------------------------------------ 03 */

export const education = {
  school: 'University of Waterloo',
  degree: 'Honours Bachelor of Computer Science',
  period: '2024 – 2029',
  where: 'Waterloo, Ontario, Canada',
}

/**
 * Courses by NAME, not by code.
 *
 * "CS 135" means something to a Waterloo student and nothing to anyone else,
 * and a grid of course codes reads like a transcript. The subject is the part
 * worth showing.
 */
export const coursework: string[] = [
  'Designing Functional Programs',
  'Elementary Algorithm Design & Data Abstraction',
  'Logic and Computation',
  'Object-Oriented Software Development',
  'Computer Organization and Design',
  'Statistics',
  'Algebra',
]

export const leadership: PillarCompany = companySchema.parse({
  id: 'waterloo-deal-group',
  name: 'Waterloo Deal Group',
  kind: 'Director of Product & Technology',
  where: 'Waterloo, Ontario · On-site',
  roles: [
    {
      id: 'director',
      title: 'Director of Product & Technology',
      period: 'Sep 2026 – Present',
      where: 'Waterloo, Ontario · On-site',
      cards: [
        {
          label: 'Role',
          value: 'Director of Product & Technology',
          note: 'Lead product and technology strategy for the club, and own its roadmap and digital presence.',
        },
        {
          label: 'Product',
          value: 'Student-facing M&A tools',
          note: 'Tools and resources that make transaction analysis, investment research and deal evaluation practical for Waterloo students.',
        },
        {
          label: 'Scope',
          value: 'Products · platforms · infrastructure',
          note: 'Infrastructure supporting private markets research, M&A analysis, financial modelling and member workflows.',
        },
        {
          label: 'Domain',
          value: 'M&A · Private markets · Investment research',
          note: 'Work with the executive team to build relationships with industry professionals, mentors and partners.',
        },
      ],
      stack: [],
    },
  ],
})
