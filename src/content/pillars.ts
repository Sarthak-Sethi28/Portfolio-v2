import { z } from 'zod'

/**
 * Content for the four navigable monuments.
 *
 * Separate from `experience.ts`, which is a flat CV list. What a pillar needs is
 * different: a handful of small titled boxes a recruiter can read in seconds,
 * with the long prose tucked behind a disclosure rather than pasted on screen.
 * The schema enforces that — `value` is capped at the length of a phrase, so a
 * paragraph physically cannot be typed into a card.
 */

/** A small box: a label, a short value, and optionally a metric to shout. */
const cardSchema = z.object({
  /** Small uppercase section label: SCOPE, IMPACT, STACK, BUILT. */
  label: z.string().min(1).max(22),
  /** The answer, as a phrase. Not a sentence, and never a paragraph. */
  value: z.string().min(1).max(90),
  /**
   * Set on the one or two cards worth reading from across the room.
   * "7 PORTFOLIO COMPANIES" lands; four equal paragraphs do not.
   */
  metric: z.boolean().default(false),
})

const roleSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  period: z.string().min(1),
  /** Place and arrangement, e.g. "Vaughan, Ontario · Hybrid". */
  where: z.string().min(1),
  cards: z.array(cardSchema).min(1).max(6),
  /** Behind a disclosure. This is where the long description is allowed to be. */
  detail: z.array(z.string().min(1)).default([]),
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
          { label: 'Scope', value: '7 portfolio companies', metric: true },
          { label: 'Ownership', value: 'Roadmap → rollout → adoption' },
          { label: 'Product', value: 'AI Maturity Assessment Platform' },
          { label: 'Delivery', value: 'Enterprise Learning Tool' },
        ],
        detail: [
          'Led product strategy and rollout for the AI maturity assessment platform across 7 portfolio companies.',
          'Owned roadmap, feature prioritization, client onboarding, demos and continuous iteration based on real user feedback.',
          'Worked directly with portfolio companies to shape the roadmap and translate stakeholder needs into improvements.',
          'Drove the product from development into active portfolio usage across engineering, AI, infrastructure, UX and business requirements.',
          'Sole engineer and PM for an enterprise Learning Tool, deployed on Azure Container Apps with automated PITR disaster recovery and zero-downtime deployments.',
        ],
        stack: ['Azure Container Apps', 'PITR', 'Zero-downtime deploys'],
      },
      {
        id: 'ai-software-engineer',
        title: 'AI Software Engineer',
        period: 'Jan 2026 – May 2026',
        where: 'Canada · Remote',
        cards: [
          { label: 'Impact', value: '10–15s → <3s', metric: true },
          { label: 'Built', value: 'Multimodal AI assessment' },
          { label: 'Architecture', value: 'Azure OpenAI · Temporal · PostgreSQL' },
          { label: 'Platform', value: 'Voice · Text · Documents' },
        ],
        detail: [
          'Architected an enterprise Legal Document Analysis platform: AI-based document extraction and validation, contract-risk identification, multilingual translation and role-based access, deployed on Azure Kubernetes Service.',
          'Built a multimodal AI maturity assessment platform supporting realtime voice conversations, text chat and document uploads, with AI analysis across 7 maturity dimensions and structured result generation.',
          'Reduced AI response time from roughly 10–15 seconds to under 3 seconds.',
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
        period: 'May 2025 – Aug 2025',
        where: 'Vaughan, Ontario · Hybrid',
        cards: [
          { label: 'AI Assistant', value: 'Product search · answers · analytics' },
          { label: 'Inventory automation', value: 'Low-stock tracking → HTML email alerts' },
          { label: 'Stack', value: 'FastAPI · React · Tailwind' },
          { label: 'E-commerce', value: 'On-page SEO contributions' },
        ],
        detail: [
          "Built a custom AI assistant for Danier's website, helping customers find products and answers to common questions, with product search, caching and analytics.",
          'Developed an automated inventory monitoring system that tracked low-stock products and sent HTML email alerts to internal stakeholders, reducing the need for manual inventory checks.',
          'Also contributed to on-page SEO.',
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
          { label: 'Healthcare platform', value: 'Hospital discovery · emergency · consultations' },
          { label: 'Backend', value: 'Python · SQL · data workflows' },
          { label: 'Cloud', value: 'AWS' },
          { label: 'Engineering', value: 'Debugging · testing · code review' },
        ],
        detail: [
          'Developed core features for a healthcare application: hospital discovery, emergency services and online consultations.',
          'Backend work across Python, SQL, AWS and data workflows.',
          'Debugging, testing, code reviews and performance-focused fixes.',
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
          { label: 'AI', value: 'Capabilities, limits and applications' },
          { label: 'Cloud', value: 'Emerging cloud computing work' },
          { label: 'Quantum', value: 'Classical vs quantum approaches' },
          { label: 'Research', value: 'Summaries · presentations · trend analysis' },
        ],
        detail: [
          'Researched emerging work in cloud computing, artificial intelligence, quantum computing and next-generation computing systems.',
          'Analyzed technical papers, architectures and industry developments, assessing capabilities, limitations and potential applications across classical and quantum approaches.',
          'Produced technical summaries, research presentations, trend analysis and areas for further study.',
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
        { label: 'Role', value: 'Director of Product & Technology' },
        { label: 'Product', value: 'Student-facing M&A tools' },
        { label: 'Scope', value: 'Product + technology strategy' },
        { label: 'Domain', value: 'M&A · Private markets · Investment research' },
      ],
      detail: [
        'Lead product and technology strategy for Waterloo Deal Group, building digital products and infrastructure supporting private markets research, M&A analysis, financial modelling and member workflows.',
        'Develop student-facing tools and resources that make transaction analysis, investment research and deal evaluation more accessible and practical for Waterloo students.',
        'Work with the executive team to build relationships with industry professionals, mentors and partners across M&A, private equity and private markets.',
        "Own the club's technology roadmap and digital presence, translating member and leadership needs into new products, platforms and initiatives.",
      ],
      stack: [],
    },
  ],
})
