export interface AccreditationReport {
  id: string
  moduleId: number
  frameworks: string[]
  criterion: string
  title: string
  hasThreeYearWindow?: boolean
  description: string
  category: 'Students' | 'Faculty' | 'Research' | 'Institution'
}

export const ACCREDITATION_REPORTS: AccreditationReport[] = [
  {
    id: 'rep-04',
    moduleId: 4,
    frameworks: ['NAAC'],
    criterion: 'NAAC · NAAC 1.2.1 / 1.2.2',
    title: 'Value-Added Courses (30 Hours or More)',
    description: 'Value-added and skill-enhancement and certificate courses of 30+ program hours with completion rates.',
    category: 'Students',
  },
  {
    id: 'rep-02',
    moduleId: 2,
    frameworks: ['NBA'],
    criterion: 'NBA · NBA Criterion 4.5',
    hasThreeYearWindow: true,
    title: 'Placements Summary (3-Year NBA Window)',
    description: 'Graduating batch placements, packages, recruiting companies, and placement percentages.',
    category: 'Students',
  },
  {
    id: 'rep-01',
    moduleId: 1,
    frameworks: ['NBA', 'NAAC'],
    criterion: 'NBA · NBA Criterion 4.5 / NAAC 5.2.1',
    hasThreeYearWindow: true,
    title: 'Higher Studies & Progression (3-Year NBA Window)',
    description: 'Student progression into higher education, qualifying competitive exams, and institutions joined.',
    category: 'Students',
  },
  {
    id: 'rep-03',
    moduleId: 3,
    frameworks: ['NAAC'],
    criterion: 'NAAC · NAAC 1.3.2',
    title: 'Student Internships & Field Projects',
    description: 'Field immersion, industrial internships, project duration, and hosting organizations.',
    category: 'Students',
  },
  {
    id: 'rep-05',
    moduleId: 5,
    frameworks: ['Institutional'],
    criterion: 'Institutional · Skill Development',
    title: 'Industry Certificates Attended by Students',
    description: 'Industry-recognized certifications achieved by undergraduate and postgraduate students.',
    category: 'Students',
  },
  {
    id: 'rep-06',
    moduleId: 6,
    frameworks: ['NAAC'],
    criterion: 'NAAC · NAAC 5.1.1 / 5.1.2',
    title: 'Scholarships & Freeships Summary (in Lakhs)',
    description: 'Government schemes, institutional freeships, private endowments, and beneficiary counts.',
    category: 'Students',
  },
  {
    id: 'rep-07',
    moduleId: 7,
    frameworks: ['NAAC'],
    criterion: 'NAAC · NAAC 3.6.3 / 5.3.3',
    title: 'Clubs, NSS & Outreach Activities',
    description: 'Student clubs, community outreach, extension activities, and NSS participation records.',
    category: 'Students',
  },
  {
    id: 'rep-08',
    moduleId: 8,
    frameworks: ['NBA', 'NIRF'],
    criterion: 'NBA · NBA Criterion 5 / NIRF FSR',
    title: 'Faculty Cadre & Student-Faculty Ratio (SFR)',
    description: 'Approved faculty positions, highest qualification, designation breakdown, and institutional SFR.',
    category: 'Faculty',
  },
  {
    id: 'rep-09',
    moduleId: 9,
    frameworks: ['NAAC'],
    criterion: 'NAAC · NAAC 6.3.3 / 6.3.2',
    title: 'Faculty Programs Attended (FDP / STTP / Workshops)',
    description: 'Professional development programs, faculty development workshops, and institutional financial support.',
    category: 'Faculty',
  },
  {
    id: 'rep-10',
    moduleId: 10,
    frameworks: ['NBA'],
    criterion: 'NBA · NBA Criterion 5.8',
    title: 'Faculty Interaction with Outside World',
    description: 'Keynote speeches, conference chair roles, editorial appointments, and external academic boards.',
    category: 'Faculty',
  },
]

