import { roleSchema, type Role } from './schema'

/** Most recent first. The monolith renders them top to bottom in this order. */
export const experience: Role[] = [
  {
    org: 'Constellation Software · Volaris Group',
    title: 'Software Developer Intern',
    location: 'Waterloo, ON',
    start: '2026-01',
    end: '2026-08',
    blurb: 'Shipping enterprise product features across cross-functional teams.',
  },
  {
    org: 'Danier',
    title: 'Software Developer',
    location: 'Toronto, ON',
    start: '2025-06',
    end: '2025-08',
    blurb:
      'Built an AI chatbot and automated low-stock alerting — sub-second responses, 100% alert delivery.',
  },
  {
    org: 'Prompt Solutions',
    title: 'Front-End Developer',
    location: 'Remote',
    start: '2023-08',
    end: '2024-07',
    blurb:
      'HIPAA-compliant healthcare platform serving 5,000+ users; 32% improvement in emergency-response efficiency.',
  },
  {
    org: 'Nokia',
    title: 'Software Engineer',
    location: 'Remote',
    start: '2023-06',
    end: '2023-07',
    blurb: 'Modernized bug-tracking — 47% faster load via optimized Postgres and Docker.',
  },
  {
    org: 'University of Waterloo',
    title: 'Honours Bachelor of Computer Science',
    location: 'Waterloo, ON',
    start: '2024-09',
    end: null,
    blurb: 'Focus on systems, AI/ML, and full-stack engineering.',
  },
].map((r) => roleSchema.parse(r))
