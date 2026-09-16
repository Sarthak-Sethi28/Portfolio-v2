import { z } from 'zod'

/**
 * The NIGHT monuments: eight projects across four columns.
 *
 * The same physical pillars carry a different subject after the crossing, so
 * these are keyed by the same slot ids the day content uses. The ids are day-
 * flavoured for historical reasons and are now simply slot names — see the note
 * on SECTIONS in content/index.ts.
 *
 * Every project declares its media through ONE shape. There is no per-project
 * layout: a project with a film and a project with four scanned pages differ
 * only in what they put in these fields, which is what stops this becoming
 * eight bespoke pages to maintain.
 */

const mediaSchema = z.object({
  kind: z.enum(['video', 'image']),
  /** Public path. Video sources are muted, looping, poster-backed. */
  src: z.string().min(1),
  /** Still shown before a video plays, and used as its thumbnail. */
  poster: z.string().optional(),
  /** Read out in the gallery strip and used as alt text. */
  label: z.string().min(1).max(40),
})

const cardSchema = z.object({
  label: z.string().min(1).max(24),
  value: z.string().min(1).max(90),
  note: z.string().min(1).max(200).optional(),
})

const projectSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  /** One line. What it is, for someone who has never heard of it. */
  descriptor: z.string().min(1).max(120),
  year: z.string().optional(),
  category: z.string().optional(),
  /** Shown as a badge. Only where one was actually won. */
  award: z.string().optional(),
  /** Context beside the award, e.g. the size of the field it was won against. */
  awardNote: z.string().max(40).optional(),
  /**
   * Further achievements, each its own badge.
   *
   * An array rather than a string, and each entry names its own firm. These are
   * two different outcomes from two different houses — a YC interview and an
   * a16z conditional offer — and a single combined line would read as one
   * result from one of them.
   */
  achievements: z.array(z.string().min(1).max(40)).default([]),
  /** The paragraph. Two or three sentences at most. */
  description: z.string().min(1),
  /** The product's own shape: NEED -> FIND -> COMPARE -> ... */
  flow: z.array(z.string()).default([]),
  cards: z.array(cardSchema).min(1).max(6),
  /**
   * Grouped, not a cloud.
   *
   * Fifteen equal pills is a wall nobody reads. Three or four named groups of
   * three or four each is scannable in about two seconds, which is all the
   * attention this section ever gets.
   */
  skills: z
    .array(z.object({ group: z.string().min(1).max(20), items: z.array(z.string()).min(1).max(6) }))
    .default([]),
  /**
   * Ordered. The first entry is the hero until the visitor picks another.
   * Empty means the project has no real media yet and the panel says so
   * rather than showing an invented screenshot.
   */
  media: z.array(mediaSchema).default([]),
  githubUrl: z.string().url().optional(),
  /** Only where a real, reachable demo exists. */
  demoUrl: z.string().url().optional(),
  /** Set while the final film is still to be made. The panel states it plainly. */
  mediaPending: z.boolean().default(false),
  /**
   * An explicit status on the cover, instead of the pending line.
   *
   * Some projects have no public media because none can exist, not because one
   * has yet to be cut. That is a different fact and it deserves different words.
   */
  status: z
    .object({ label: z.string().min(1).max(30), note: z.string().min(1).max(90).optional() })
    .optional(),
})

export type ProjectMedia = z.infer<typeof mediaSchema>
export type Project = z.infer<typeof projectSchema>

const p = (v: unknown) => projectSchema.parse(v)

/* ------------------------------------------------------------------ 01 */

export const projectsI: Project[] = [
  p({
    id: 'valldor',
    name: 'Valldor',
    descriptor: 'Autonomous procurement intelligence for manufacturers.',
    category: 'Autonomous systems',
    description:
      'An agent that runs a procurement mission end to end: it reads what inventory demands, finds vendors, researches market price, evaluates and negotiates, and comes back with a purchase order rather than a shortlist.',
    flow: ['Need', 'Find vendors', 'Compare', 'RFQ', 'Negotiate', 'Approve', 'PO'],
    cards: [
      {
        label: 'Autonomous sourcing',
        value: 'Inventory-driven missions',
        note: 'Vendor discovery and market-price research run from what stock actually demands, not from a manual brief.',
      },
      {
        label: 'AI negotiation',
        value: 'RFQ → negotiation → acceptance',
        note: 'LOI and RFQ generation, a vendor portal, negotiation and deal acceptance, ending in a generated purchase order.',
      },
      {
        label: 'Vendor intelligence',
        value: 'Existing and prospective vendors',
        note: 'Evaluation across both, with supply-chain and market signals feeding the comparison.',
      },
      {
        label: 'Procurement workflow',
        value: 'Approvals built in',
        note: 'The full path from requirement to authorised order, with approval gates where a human decides.',
      },
    ],
    skills: [
      { group: 'AI / Automation', items: ['AI agents', 'Autonomous workflows', 'AI negotiation'] },
      { group: 'Procurement', items: ['Vendor discovery', 'Supplier intelligence', 'RFQ', 'LOI', 'Purchase orders'] },
      { group: 'Engineering', items: ['Full-stack engineering', 'Workflow architecture', 'Product engineering'] },
    ],
    achievements: ['Y Combinator interview', 'a16z conditional offer'],
    media: [
      { kind: 'video', src: '/projects/valldor/hero.mp4', poster: '/projects/valldor/poster.jpg', label: 'Product film' },
      { kind: 'image', src: '/projects/valldor/compare.jpg', label: 'Vendor comparison' },
      { kind: 'image', src: '/projects/valldor/negotiate.jpg', label: 'Negotiation' },
      { kind: 'image', src: '/projects/valldor/order.jpg', label: 'Purchase order' },
    ],
    githubUrl: 'https://github.com/Sarthak-Sethi28/openclaw',
  }),
  p({
    id: 'muse-sketch-studio',
    name: 'Muse Sketch Studio',
    descriptor: 'AI-powered fashion design pipeline from idea to runway.',
    category: 'Generative product',
    award: '1st place — Replicate AI Hackathon',
    awardNote: '100+ participants',
    description:
      'A prompt becomes a professional fashion sketch, the sketch is coloured, the design is worn by a generated model, and the look walks a generated runway. Every stage is downloadable, so the pipeline produces assets rather than previews.',
    flow: ['Prompt', 'Sketch', 'Colour', 'Model', 'Runway'],
    cards: [
      {
        label: 'Sketch',
        value: 'Text prompt → fashion sketch',
        note: 'A written idea becomes a professional technical sketch.',
      },
      {
        label: 'Colour',
        value: 'AI colour transformation',
        note: 'The line drawing is rendered into a finished, coloured design.',
      },
      {
        label: 'Model',
        value: 'Fashion photography generation',
        note: 'The design is placed on a generated model as editorial photography.',
      },
      {
        label: 'Runway',
        value: 'Generated runway video',
        note: 'The finished look is animated into a runway sequence, downloadable with every other stage.',
      },
    ],
    skills: [
      { group: 'Generative AI', items: ['Image generation', 'Video generation', 'Multimodal', 'Prompt engineering'] },
      { group: 'Product', items: ['React', 'TypeScript', 'Node.js'] },
      { group: 'AI services', items: ['Replicate', 'Google Nano Banana', 'Veo'] },
    ],
    // Three supporting stills, not seven: sketch, colour, model — the pipeline
    // in the fewest frames that still explain it.
    media: [
      { kind: 'video', src: '/projects/muse/demo.mp4', poster: '/projects/muse/poster.jpg', label: 'Full demo' },
      { kind: 'image', src: '/projects/muse/01-sketch.jpg', label: 'Sketch' },
      { kind: 'image', src: '/projects/muse/03-colour.jpg', label: 'Coloured' },
      { kind: 'image', src: '/projects/muse/04-model.jpg', label: 'On model' },
    ],
    githubUrl: 'https://github.com/Sarthak-Sethi28/muse-sketch-studio',
  }),
]

/* ------------------------------------------------------------------ 02 */

export const projectsII: Project[] = [
  p({
    id: 'yardvision',
    name: 'YardVision',
    descriptor: 'A measured yard-design system that turns a real property into a buildable design.',
    category: 'Spatial software',
    description:
      'Starts from an address rather than from a blank canvas. The property is identified, the buildable area is measured against real setbacks, and landscaping is positioned within those constraints — so the visualisation describes something that could actually be built.',
    flow: ['Address', 'Property', 'Buildable area', 'Layout', 'Visualisation'],
    cards: [
      {
        label: 'Real property data',
        value: 'Address → parcel',
        note: 'An address resolves to a real lot, confirmed by the user before anything is designed.',
      },
      {
        label: 'Measured geometry',
        value: 'Setbacks and buildable area',
        note: 'Parcel geometry and measured constraints, not a yard treated as a generic picture.',
      },
      {
        label: 'Design engine',
        value: 'Positioned landscaping',
        note: 'Elements are placed within the measured area rather than composed freehand.',
      },
      {
        label: 'Visualisation',
        value: 'Rendered yard, true scale',
        note: 'Rendered from the same measurements, with a true-scale/AR direction in the system.',
      },
    ],
    skills: [
      { group: 'Spatial', items: ['Property geometry', 'Computational geometry', 'Mapping / spatial data'] },
      { group: 'Visualization', items: ['3D visualization', 'Interactive graphics', 'Digital twin'] },
      { group: 'Product', items: ['Product engineering', 'Frontend engineering', 'AI-assisted workflows'] },
    ],
    media: [],
    mediaPending: true,
    // The capture package does not exist yet, so the cover says where the
    // product actually is rather than promising a film.
    status: { label: 'In development' },
  }),
  p({
    id: 'danier-chatbot',
    name: 'Danier AI Shopping Assistant',
    descriptor: "Context-aware AI product discovery built for Danier's e-commerce experience.",
    year: '2025',
    category: 'E-commerce AI',
    description:
      'A shopper describes what they want in their own words and the assistant narrows it down — category, price, colour, season — holding the thread across the whole conversation so each answer refines the last rather than starting again.',
    flow: ['Ask', 'Refine', 'Filter', 'Product links'],
    cards: [
      {
        label: 'Natural language',
        value: 'Discovery by description',
        note: 'Product and category discovery from ordinary phrasing, not a filter panel.',
      },
      {
        label: 'Progressive refinement',
        value: 'Price · colour · category',
        note: 'Filters accumulate across turns, including gender and category awareness.',
      },
      {
        label: 'Context',
        value: 'Conversation persistence',
        note: 'Chat history and context persist, so the thread is never lost mid-search.',
      },
      {
        label: 'Commerce',
        value: 'Direct product links',
        note: 'Answers resolve to real, season-aware products a shopper can open.',
      },
    ],
    skills: [
      { group: 'AI', items: ['Conversational AI', 'Product discovery', 'Context handling'] },
      { group: 'Product', items: ['React', 'Tailwind CSS'] },
      { group: 'Backend', items: ['FastAPI', 'Product search', 'Caching', 'Analytics'] },
    ],
    media: [
      { kind: 'video', src: '/projects/chatbot/demo.mp4', poster: '/projects/chatbot/poster.jpg', label: 'Full demo' },
      { kind: 'image', src: '/projects/chatbot/shot-1.jpg', label: 'Assistant' },
      { kind: 'image', src: '/projects/chatbot/shot-2.jpg', label: 'Refinement' },
      { kind: 'image', src: '/projects/chatbot/shot-3.jpg', label: 'Results' },
    ],
    githubUrl: 'https://github.com/Sarthak-Sethi28/Danier-Chatbot',
  }),
]

/* ------------------------------------------------------------------ 03 */

export const projectsIII: Project[] = [
  p({
    id: 'danier-inventory',
    name: 'Danier Inventory Monitoring',
    descriptor: 'Automated inventory intelligence and low-stock alerting for retail operations.',
    year: '2025',
    category: 'Retail operations',
    description:
      'Watches stock levels continuously, detects what is about to run out, and emails the people who can act on it — replacing a manual check that only happened when someone remembered to do it.',
    flow: ['Ingest', 'Monitor', 'Detect', 'Alert', 'Analyse'],
    cards: [
      {
        label: 'Inventory monitoring',
        value: 'Continuous stock levels',
        note: 'Tracking across products, with reorder and low-stock detection.',
      },
      {
        label: 'Automated alerts',
        value: 'HTML email to stakeholders',
        note: 'Alerts reach internal stakeholders directly, with a history of what was sent.',
      },
      {
        label: 'Analytics',
        value: 'Inventory dashboard',
        note: 'Analytics over stock movement rather than a single point-in-time view.',
      },
      {
        label: 'Data pipeline',
        value: 'Excel / file ingestion',
        note: 'Ingests the spreadsheets the business already produces.',
      },
    ],
    skills: [
      { group: 'Backend', items: ['Python', 'FastAPI', 'SQLAlchemy'] },
      { group: 'Data', items: ['Pandas', 'OpenPyXL', 'Data processing'] },
      { group: 'Automation', items: ['Inventory automation', 'Email automation'] },
    ],
    media: [],
    /*
     * Not "film in production". This one is not waiting on a film — it runs
     * inside someone else's business, which is why there is no public demo to
     * show, and saying so is a stronger statement than an apology for missing
     * footage.
     */
    status: { label: 'Internal product', note: "Built for Danier's internal inventory operations" },
    githubUrl: 'https://github.com/Sarthak-Sethi28/DANIER-S-ALERT-SYSTEM-',
  }),
  p({
    id: 'caraksha',
    name: 'CaRaksha',
    descriptor: 'Portable road-safety system designed to reduce preventable road accidents.',
    category: 'Hardware · Safety',
    award: '1st prize — All India Techfest',
    description:
      'A console-mounted device addressing the three causes the project identified behind Indian road accidents: distraction, drink-driving and overspeeding. It watches the driver and the road, and in a crash it calls for help by itself.',
    flow: ['Sense', 'Warn', 'Detect', 'Respond'],
    cards: [
      {
        label: 'Driver monitoring',
        value: 'Sleep · distraction · alcohol',
        note: 'Camera-based eye and face monitoring, with an ethanol sensor for drink-driving.',
      },
      {
        label: 'Overspeeding',
        value: 'Speed and proximity alerts',
        note: 'Buzzers warn the driver, with ultrasonic sensing of nearby vehicles.',
      },
      {
        label: 'Accident response',
        value: 'SOS · GPS · health card',
        note: 'On impact it sends SOS with location to family and the nearest hospital, and displays the driver’s health information.',
      },
      {
        label: 'Road mapping',
        value: 'Potholes and obstacles',
        note: 'An external camera maps road quality against GPS, intended to make road surveys cheaper.',
      },
    ],
    skills: [
      { group: 'Hardware', items: ['Arduino', 'Raspberry Pi', 'Sensors', 'GPS', 'GSM'] },
      { group: 'Perception', items: ['Camera / computer vision', 'Ultrasonic sensing', 'Alcohol detection'] },
      { group: 'Engineering', items: ['Embedded systems', 'Hardware prototyping', 'IoT'] },
    ],
    media: [
      { kind: 'image', src: '/projects/caraksha/hero.jpg', label: 'Prototype' },
      { kind: 'image', src: '/projects/caraksha/components.jpg', label: 'Components' },
    ],
    githubUrl: 'https://github.com/Sarthak-Sethi28/CaRaksha',
  }),
]

/* ------------------------------------------------------------------ 04 */

export const projectsIV: Project[] = [
  p({
    id: 'imoney',
    name: 'iMoney',
    descriptor: 'Accessible currency-identification device for visually impaired users.',
    category: 'Hardware · Accessibility',
    description:
      'Notes are fed into a tray, measured, identified by denomination, and the running total is spoken aloud — so counting money does not depend on sight or on asking someone else.',
    flow: ['Insert', 'Measure', 'Identify', 'Speak total'],
    cards: [
      {
        label: 'Accessibility',
        value: 'Audio output of the total',
        note: 'The device speaks the amount, built around a simple physical interaction.',
      },
      {
        label: 'Currency detection',
        value: 'Multiple Indian denominations',
        note: 'Identifies denominations and accumulates a running total across notes.',
      },
      {
        label: 'Hardware',
        value: 'Motorised tray and chamber',
        note: 'A spring-loaded input tray moves each note past the sensor into a collection chamber.',
      },
      {
        label: 'Measurement',
        value: '2D laser scanning',
        note: 'A 2D scanner measures each note’s dimensions as it passes.',
      },
    ],
    skills: [
      { group: 'Accessibility', items: ['Assistive technology', 'Accessibility engineering'] },
      { group: 'Hardware', items: ['Raspberry Pi', 'Motors', '2D scanning', 'Audio output'] },
      { group: 'Software', items: ['C++', 'Embedded processing', 'Hardware / software integration'] },
    ],
    media: [
      { kind: 'image', src: '/projects/imoney/hero.jpg', label: 'Device' },
      // The hand-drawn mechanism from the project document: input tray, 2D laser
      // scanner, collection chamber, motors, speaker. Secondary, but authentic.
      { kind: 'image', src: '/projects/imoney/schematic.jpg', label: 'Mechanism' },
    ],
    githubUrl: 'https://github.com/Sarthak-Sethi28/iMoney',
  }),
  p({
    id: 'gim',
    name: 'GIM Band — Guard in Motion',
    descriptor: 'Wearable personal-safety concept for discreet emergency response.',
    category: 'Hardware · Concept',
    description:
      'A wrist-worn band with a concealed panic button. Pressing it starts recording audio and video, sends location to chosen contacts, and raises an alarm — designed to be activated without drawing attention. Developed to prototype and proposal stage.',
    flow: ['Press', 'Record', 'Locate', 'Alert'],
    cards: [
      {
        label: 'One touch',
        value: 'Concealed panic button',
        note: 'Discreet activation, designed to be pressed without being seen.',
      },
      {
        label: 'Evidence',
        value: 'Audio and video capture',
        note: 'Camera and microphone record the situation for later use by contacts or authorities.',
      },
      {
        label: 'Location',
        value: 'GPS to emergency contacts',
        note: 'Real-time location sent to a designated contact alongside the alert.',
      },
      {
        label: 'Sensing',
        value: 'Motion and gyro',
        note: 'Accelerometer and gyroscope to detect unexpected movement or impact.',
      },
    ],
    skills: [
      { group: 'Wearable', items: ['Wearable technology', 'Embedded systems', 'Hardware prototyping'] },
      { group: 'Sensing', items: ['GPS', 'Accelerometer', 'Gyroscope', 'Camera', 'Microphone'] },
      { group: 'Connected', items: ['Emergency alerting', 'Wireless', 'Cloud integration', 'Mobile'] },
    ],
    /*
     * No media, deliberately.
     *
     * The GIM proposal is text end to end — measured ink coverage is a flat
     * 2.5-3.7% on all six pages, which is body copy and no figures. There is no
     * photograph, diagram or schematic in it to show. Rather than promote pages
     * of prose to hero imagery, this carries the designed cover and says the
     * film is still to come, which is the truth.
     */
    media: [
      { kind: 'image', src: '/projects/gim/hero.jpg', label: 'Concept visualization' },
    ],
    /*
     * Labelled, not passed off.
     *
     * GIM reached proposal and prototype stage. This render is a concept
     * visualisation built from that documentation, and the badge says so — a
     * polished image of a device that was never manufactured would otherwise
     * read as a photograph of a finished product.
     */
    status: { label: 'Concept visualization', note: 'Developed to proposal and prototype stage' },
    githubUrl: 'https://github.com/Sarthak-Sethi28/GIM',
  }),
]

/** Slot id → its two projects, and the name the pillar carries at night. */
export const NIGHT_PILLARS = {
  'experience-i': { label: 'PROJECTS I', projects: projectsI },
  'experience-ii': { label: 'PROJECTS II', projects: projectsII },
  waterloo: { label: 'PROJECTS III', projects: projectsIII },
  contact: { label: 'PROJECTS IV', projects: projectsIV },
} as const
