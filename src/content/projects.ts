import { projectSchema, type Project } from './schema'

/**
 * Ordered by weight. Pillar 1 stands nearest the aperture and is read first.
 *
 * The colonnade sizes itself from this array's length — adding or removing a
 * project requires no other change anywhere in the codebase. That property is
 * asserted in tests/unit/colonnade.test.ts against 3- and 12-project fixtures.
 */
export const projects: Project[] = [
  {
    slug: 'valldor',
    title: 'Valldor',
    blurb: 'Autonomous procurement software.',
    body: 'Agentic procurement — sourcing, quoting, and negotiation handled end to end by a system of cooperating AI agents rather than a purchasing team.',
    stack: ['AI Agents', 'TypeScript', 'Python'],
    accolade: 'a16z conditional offer · YC interview',
    year: 2026,
  },
  {
    slug: 'muse-sketch-studio',
    title: 'Muse Sketch Studio',
    blurb: 'AI design pipeline: prompt to sketch to runway video.',
    body: 'A generative pipeline that takes a text prompt through concept sketch to a finished runway video, chaining several models behind one interface.',
    stack: ['React', 'TypeScript', 'Node.js', 'Replicate'],
    accolade: 'Hackathon winner',
    repo: 'https://github.com/Sarthak-Sethi28/muse-sketch-studio',
    live: 'https://muse-sketch-studio.vercel.app',
    year: 2025,
  },
  {
    slug: 'carraksha',
    title: 'CarRaksha',
    blurb: 'Collision prevention with impaired-driving detection.',
    body: 'An Arduino system that watches for impaired driving patterns and intervenes before a collision, built on embedded C++ and a sensor array.',
    stack: ['C++', 'Arduino'],
    accolade: '1st prize',
    repo: 'https://github.com/Sarthak-Sethi28/CaRaksha',
    year: 2023,
  },
  {
    slug: 'custom-chatbot',
    title: 'Custom Chatbot',
    blurb: 'Shopify-syncing AI search, sub-second responses.',
    body: 'A retail chatbot that keeps itself in sync with a live Shopify catalogue and answers product questions in under a second.',
    stack: ['FastAPI', 'React', 'OpenAI'],
    repo: 'https://github.com/Sarthak-Sethi28/Danier-Chatbot',
    year: 2025,
  },
  {
    slug: 'imoney',
    title: 'iMoney',
    blurb: 'WCAG 2.1 AAA finance app for the visually impaired.',
    body: 'A personal finance application built to the strictest accessibility standard, navigable entirely by speech and screen reader.',
    stack: ['React', 'Node.js', 'MongoDB', 'Web Speech'],
    repo: 'https://github.com/Sarthak-Sethi28/iMoney',
    year: 2024,
  },
  {
    slug: 'low-stock-alerts',
    title: 'Low-Stock Alert System',
    blurb: 'Automated inventory alerts, 100% delivery reliability.',
    body: 'An inventory watchdog that detects low stock across a retail catalogue and delivers alerts with no dropped notifications.',
    stack: ['FastAPI', 'SQLAlchemy', 'Pandas'],
    accolade: 'Internal tool',
    year: 2025,
  },
].map((p) => projectSchema.parse(p))
