import { profileSchema, type Profile } from './schema'

export const profile: Profile = profileSchema.parse({
  name: 'Sarthak Sethi',
  role: 'Software Engineer / AI',
  education: 'Honours CS @ University of Waterloo',
  status: 'Building @ Volaris · open to Summer 2026',
  about: [
    'I build systems that read signals and make sense of them — AI agents, data pipelines, and the full-stack products wrapped around them.',
    'Currently a software developer intern at Constellation Software / Volaris Group in Waterloo, shipping enterprise product features across cross-functional teams.',
    'Before that: an AI chatbot and alerting system at Danier, a HIPAA-compliant healthcare platform at Prompt Solutions, and bug-tracking infrastructure at Nokia.',
  ],
  email: 's36sethi@uwaterloo.ca',
  socials: [
    { label: 'GitHub', href: 'https://github.com/Sarthak-Sethi28' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/sarthak2803' },
  ],
  stack: [
    'Python', 'TypeScript', 'JavaScript', 'C++',
    'React', 'Redux', 'Tailwind', 'Three.js',
    'Node.js', 'Express', 'FastAPI', 'Flask', 'Django', 'GraphQL',
    'PostgreSQL', 'MySQL', 'MongoDB',
    'TensorFlow', 'PyTorch', 'scikit-learn', 'Hugging Face', 'OpenAI',
    'Docker', 'Git', 'Arduino', 'Vercel',
  ],
  builds: ['AI agents', 'SaaS products', 'Dev tools', 'Full-stack apps', 'ML pipelines'],
})
