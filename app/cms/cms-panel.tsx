'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Database,
  Users,
  Building2,
  GraduationCap,
  Calendar,
  Shield,
  FileSpreadsheet,
  History,
  Search,
  ExternalLink,
  RefreshCw,
  Eye,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X,
  Layers,
  ArrowLeft,
  KeyRound,
  FileCode,
  ShieldAlert,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Lock,
  Unlock,
  FileCheck,
  SlidersHorizontal,
  Sliders,
  CheckSquare,
  Square,
  Settings2,
  AlertTriangle,
  Menu,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import {
  DEMO_USERS,
  DEMO_SCHOOLS,
  DEMO_DEPARTMENTS,
  DEMO_PROGRAMMES,
  DEMO_DIRECTORY,
  DEMO_AUDIT_LOG,
  DEMO_RECORDS,
} from '@/lib/mock-demo-data'
import { supabase } from '@/lib/supabase'

export type TableId =
  | 'overview'
  | 'users'
  | 'assignments'
  | 'roles'
  | 'permissions'
  | 'schools'
  | 'departments'
  | 'programmes'
  | 'academic_years'
  | 'records'
  | 'audit_log'

interface TableMeta {
  id: TableId
  name: string
  sqlName: string
  icon: any
  description: string
  badgeCount?: number
}

// 25 Official Criteria Modules from Specification PDF
export interface CriteriaModuleDef {
  id: number
  name: string
  category: 'Students' | 'Faculty' | 'Research' | 'Institutional'
}

export const CRITERIA_MODULES_25: CriteriaModuleDef[] = [
  { id: 1, name: 'Higher Studies', category: 'Students' },
  { id: 2, name: 'Placements', category: 'Students' },
  { id: 3, name: 'Internships', category: 'Students' },
  { id: 4, name: 'Value-Added Courses', category: 'Students' },
  { id: 5, name: 'Industry Certificates', category: 'Students' },
  { id: 6, name: 'Scholarships', category: 'Students' },
  { id: 7, name: 'Clubs', category: 'Students' },
  { id: 8, name: 'Faculty Profile', category: 'Faculty' },
  { id: 9, name: 'Faculty Programs', category: 'Faculty' },
  { id: 10, name: 'Faculty Interaction', category: 'Faculty' },
  { id: 11, name: 'Publications', category: 'Research' },
  { id: 12, name: 'Grants', category: 'Research' },
  { id: 13, name: 'Consultancy', category: 'Research' },
  { id: 14, name: 'Patents', category: 'Research' },
  { id: 15, name: 'Copyright', category: 'Research' },
  { id: 16, name: 'Startups / Entrepreneurship', category: 'Research' },
  { id: 17, name: 'Events', category: 'Institutional' },
  { id: 18, name: 'MoUs', category: 'Institutional' },
  { id: 19, name: 'Infrastructure', category: 'Institutional' },
  { id: 20, name: 'Best Practices', category: 'Institutional' },
  { id: 21, name: 'Notable Achievements', category: 'Institutional' },
  { id: 22, name: 'Committees', category: 'Institutional' },
  { id: 23, name: 'Policies', category: 'Institutional' },
  { id: 24, name: 'Programs & Intake', category: 'Institutional' },
  { id: 25, name: 'Faculty Citations & h-index', category: 'Faculty' },
]

// Official 10 Roles defined in PDF (Specification Section 27 & 28)
export interface PdfRoleDef {
  id: number
  name: string
  level: 'Institute' | 'School' | 'Department' | 'Own Records'
  can_verify: boolean
  can_export: boolean
  can_see_restricted: boolean
  whatTheyDo: string // Direct quote from PDF Table "What they do"
  capabilities: string[]
}

export const PDF_ROLES: PdfRoleDef[] = [
  {
    id: 1,
    name: 'Super Admin',
    level: 'Institute',
    can_verify: false,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Manages users, roles and master lists; does not need restricted data',
    capabilities: [
      'Create and manage staff accounts & user logins',
      'Assign & revoke any of the 10 roles to any staff member',
      'Manage Master Data (Schools, Departments, Programmes, Academic Years)',
      'Configure system-wide settings and role permissions',
    ],
  },
  {
    id: 2,
    name: 'Principal / Director',
    level: 'Institute',
    can_verify: true,
    can_export: true,
    can_see_restricted: true,
    whatTheyDo: 'Views everything, gives final approval, exports reports',
    capabilities: [
      'View all institutional accreditation records across all schools and departments',
      'Final approval and institutional verification of all criteria',
      'Export consolidated institutional reports (NAAC, NBA, NIRF)',
      'Full visibility into restricted fields (financial amounts, personal phone/email)',
    ],
  },
  {
    id: 3,
    name: 'IQAC Coordinator',
    level: 'Institute',
    can_verify: true,
    can_export: true,
    can_see_restricted: true,
    whatTheyDo: 'Views and verifies all records, assigns criteria owners, generates NAAC and NBA reports',
    capabilities: [
      'Coordinates university accreditation operations and audits',
      'Verifies records across all 25 criteria data types',
      'Assigns specific criteria owners and peer reviewers',
      'Generates and exports NAAC SSR and NBA criteria reports',
      'Access to restricted fields for institutional compliance',
    ],
  },
  {
    id: 4,
    name: 'IQAC Member',
    level: 'Institute',
    can_verify: true,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Views and verifies records assigned to them',
    capabilities: [
      'Review and verify individually assigned criteria evidence items',
      'Mark records as Verified or Reject back to Draft with required remarks',
      'Inspect proof attachments for assigned accreditation modules',
    ],
  },
  {
    id: 5,
    name: 'Dean',
    level: 'School',
    can_verify: true,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Views and verifies records for their school',
    capabilities: [
      'Full verification authority for all departments within their School (e.g. Engineering)',
      'Review and approve school-level faculty publications and curriculum events',
      'Monitor accreditation progress across constituent departments',
    ],
  },
  {
    id: 6,
    name: 'HOD',
    level: 'Department',
    can_verify: true,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Verifies records for their department',
    capabilities: [
      'Verify and approve records submitted by faculty within their department',
      'Approve department coordinator draft entries',
      'Oversee department criteria metrics (placements, internships, grants)',
    ],
  },
  {
    id: 7,
    name: 'Department Coordinator',
    level: 'Department',
    can_verify: false,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Enters and edits records for the department (teaching or non-teaching staff)',
    capabilities: [
      'Create and edit draft accreditation records for the whole department',
      'Submit finalized department batches for HOD / IQAC review',
      'Perform bulk Excel/CSV data imports for department criteria',
    ],
  },
  {
    id: 8,
    name: 'Faculty',
    level: 'Own Records',
    can_verify: false,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Adds and edits their own records',
    capabilities: [
      'Create, edit, and maintain personal faculty profile and citations (h-index, i10)',
      'Add own publications, patents, consultancy, research grants, and awards',
      'Upload proof documents and submit records for department verification',
    ],
  },
  {
    id: 9,
    name: 'Non-teaching Staff',
    level: 'Own Records',
    can_verify: false,
    can_export: false,
    can_see_restricted: false,
    whatTheyDo: 'Adds records for their own section',
    capabilities: [
      'Maintain operational records for assigned administrative sections',
      'Record student club activities, scholarships, and infrastructure logs',
      'Upload institutional committee meeting minutes and policy documents',
    ],
  },
  {
    id: 10,
    name: 'Reviewer',
    level: 'Institute',
    can_verify: false,
    can_export: true,
    can_see_restricted: false,
    whatTheyDo: 'Views and exports verified records for audit, with an end date',
    capabilities: [
      'Time-limited read-only audit access for mock peer-teams or statutory auditors',
      'Inspect already-verified records without modification rights',
      'Export verified criteria datasets for evaluation reports',
    ],
  },
]

// Dynamic Scope Configuration (Dynamic Scope Allocation)
export interface DynamicScopeConfig {
  scopeLevel: 'Institute' | 'School' | 'Department' | 'Own Records'
  school?: string
  department?: string
  // Granular capability overrides delegated from higher roles (e.g. Principal)
  canVerify?: boolean
  canExport?: boolean // Delegated Principal/IQAC power
  canSeeRestricted?: boolean // Delegated Principal power
  canFinalApprove?: boolean // Delegated Principal power
  canEditAny?: boolean
  // Specific Criteria Covered (1-25)
  allowedDataTypes?: number[]
  delegatedFrom?: string // e.g. 'Principal / Director'
  delegationLabel?: string
  delegatedPowers?: string[]
}

export interface UserRoleAssignment {
  id: string
  userId: string
  userEmpId: string
  userName: string
  roleName: string
  level: string
  school?: string
  department?: string
  validFrom: string
  validTo?: string
  assignedBy: string
  assignedOn: string
  delegatedPowers?: string[]
  criteriaCoverage?: string
}

export interface CmsUser {
  id: string
  empId: string
  name: string
  email: string
  designation: string
  department: string
  school: string
  staffType: 'Teaching' | 'Non-Teaching'
  roles: string[] // Multi-role support: user can have multiple roles
  customScope?: DynamicScopeConfig // Granular dynamic scope allocation
  status: 'Active' | 'Inactive' | 'Pending Approval'
  createdOn: string
}

// Helper to calculate effective capabilities across all assigned roles + dynamic scope overrides
export function computeUserCapabilities(
  roles: string[],
  customScope?: DynamicScopeConfig
) {
  const roleDefs = roles
    .map((r) => PDF_ROLES.find((def) => def.name === r))
    .filter(Boolean) as PdfRoleDef[]

  // Base capabilities aggregated from all held roles
  let canVerify = roleDefs.some((r) => r.can_verify)
  let canExport = roleDefs.some((r) => r.can_export)
  let canSeeRestricted = roleDefs.some((r) => r.can_see_restricted)
  let canFinalApprove = roles.includes('Principal / Director')

  // Find highest natural scope level
  const hierarchyOrder = ['Own Records', 'Department', 'School', 'Institute']
  let highestScope: 'Institute' | 'School' | 'Department' | 'Own Records' =
    'Own Records'

  for (const def of roleDefs) {
    if (
      hierarchyOrder.indexOf(def.level) > hierarchyOrder.indexOf(highestScope)
    ) {
      highestScope = def.level
    }
  }

  // Dynamic Scope Delegations (e.g. Principal overrides for HOD)
  const delegatedPowers: string[] = []
  if (customScope) {
    if (customScope.scopeLevel) {
      highestScope = customScope.scopeLevel
    }
    if (customScope.canVerify !== undefined) {
      if (customScope.canVerify && !canVerify) {
        delegatedPowers.push('Record Verification (Delegated)')
      }
      canVerify = customScope.canVerify
    }
    if (customScope.canExport !== undefined) {
      if (customScope.canExport && !canExport) {
        delegatedPowers.push('Export Reports NAAC/NBA (Delegated from Principal)')
      }
      canExport = customScope.canExport
    }
    if (customScope.canSeeRestricted !== undefined) {
      if (customScope.canSeeRestricted && !canSeeRestricted) {
        delegatedPowers.push(
          'Restricted Financial/Confidential Data (Delegated from Principal)'
        )
      }
      canSeeRestricted = customScope.canSeeRestricted
    }
    if (customScope.canFinalApprove !== undefined) {
      if (customScope.canFinalApprove && !canFinalApprove) {
        delegatedPowers.push('Final Institutional Sign-Off (Delegated from Principal)')
      }
      canFinalApprove = customScope.canFinalApprove
    }
  }

  const whatTheyDoList = roleDefs.map((r) => ({
    role: r.name,
    text: r.whatTheyDo,
  }))

  const allCapabilities = Array.from(
    new Set(roleDefs.flatMap((r) => r.capabilities))
  )

  const allowedDataTypes =
    customScope?.allowedDataTypes || Array.from({ length: 25 }, (_, i) => i + 1)

  return {
    canVerify,
    canExport,
    canSeeRestricted,
    canFinalApprove,
    highestScope,
    delegatedPowers,
    whatTheyDoList,
    allCapabilities,
    allowedDataTypes,
  }
}

export function CmsPanel() {
  const [activeTable, setActiveTable] = useState<TableId>('users')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRow, setSelectedRow] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // User & Role State with Multi-Role and Dynamic Scope
  const [users, setUsers] = useState<CmsUser[]>([
    {
      id: 'usr_001',
      empId: 'PU-FAC-0142',
      name: 'Dr. Meera Nair',
      email: 'meera.nair@pillai.edu',
      designation: 'Director & Professor',
      department: 'Management Studies',
      school: 'School of Management',
      staffType: 'Teaching',
      roles: ['Principal / Director', 'Faculty'],
      status: 'Active',
      createdOn: '2023-01-15',
    },
    {
      id: 'usr_002',
      empId: 'PU-FAC-0089',
      name: 'Dr. Arvind Gokhale',
      email: 'arvind.gokhale@pillai.edu',
      designation: 'Professor & IQAC Head',
      department: 'Computer Engineering',
      school: 'School of Engineering',
      staffType: 'Teaching',
      roles: ['IQAC Coordinator', 'Super Admin', 'Faculty'],
      status: 'Active',
      createdOn: '2022-06-10',
    },
    {
      id: 'usr_003',
      empId: 'PU-FAC-0210',
      name: 'Dr. Rajeshwari Iyer',
      email: 'r.iyer@pillai.edu',
      designation: 'Professor & Head of Department',
      department: 'Computer Engineering',
      school: 'School of Engineering',
      staffType: 'Teaching',
      roles: ['HOD', 'Department Coordinator', 'Faculty'],
      // Dynamic Scope allocated: HOD with delegated Principal's Export Power & 8 criteria modules
      customScope: {
        scopeLevel: 'Department',
        department: 'Computer Engineering',
        school: 'School of Engineering',
        canExport: true, // DELEGATED FROM PRINCIPAL
        canSeeRestricted: true, // DELEGATED FROM PRINCIPAL
        allowedDataTypes: [1, 2, 3, 8, 11, 12, 13, 14],
        delegatedFrom: 'Principal / Director',
        delegationLabel:
          'Export Institutional NAAC / NBA Reports (Delegated from Principal)',
      },
      status: 'Active',
      createdOn: '2023-08-01',
    },
    {
      id: 'usr_004',
      empId: 'PU-FAC-0112',
      name: 'Dr. Vikram Kulkarni',
      email: 'v.kulkarni@pillai.edu',
      designation: 'Dean, Faculty of Tech',
      department: 'Mechanical Engineering',
      school: 'School of Engineering',
      staffType: 'Teaching',
      roles: ['Dean', 'Faculty'],
      status: 'Active',
      createdOn: '2021-07-20',
    },
    {
      id: 'usr_005',
      empId: 'PU-FAC-0315',
      name: 'Prof. Sneha Patil',
      email: 'sneha.patil@pillai.edu',
      designation: 'Assistant Professor & NAAC In-charge',
      department: 'Information Technology',
      school: 'School of Engineering',
      staffType: 'Teaching',
      roles: ['Department Coordinator', 'IQAC Member', 'Faculty'],
      status: 'Active',
      createdOn: '2024-01-10',
    },
    {
      id: 'usr_006',
      empId: 'PU-NON-0044',
      name: 'Mr. Ramesh Joshi',
      email: 'r.joshi@pillai.edu',
      designation: 'Senior Registrar & Admin Officer',
      department: 'Administrative Section',
      school: 'Central Administration',
      staffType: 'Non-Teaching',
      roles: ['Non-teaching Staff', 'Department Coordinator'],
      status: 'Active',
      createdOn: '2020-03-01',
    },
    {
      id: 'usr_007',
      empId: 'PU-AUD-0001',
      name: 'Dr. Ashok Sharma (External Peer)',
      email: 'ashok.sharma@external-audit.org',
      designation: 'External Mock Auditor',
      department: 'Audit Committee',
      school: 'External Reviewers Panel',
      staffType: 'Teaching',
      roles: ['Reviewer'],
      customScope: {
        scopeLevel: 'Institute',
        canExport: true,
        canVerify: false,
        canSeeRestricted: false,
        allowedDataTypes: [11, 12, 13, 14, 15, 16],
      },
      status: 'Active',
      createdOn: '2025-01-15',
    },
  ])

  // Sync registered staff accounts from localStorage, Supabase & registration events
  const syncRegisteredUsers = async () => {
    try {
      const stored = localStorage.getItem('pu_registered_users')
      if (stored) {
        const registered = JSON.parse(stored)
        setUsers((prev) => {
          const map = new Map(prev.map((u) => [u.id, u]))
          registered.forEach((reg: any) => {
            const isApproved = reg.status === 'Active'
            map.set(reg.id, {
              id: reg.id,
              empId: reg.empId,
              name: reg.name,
              email: reg.email,
              designation: reg.designation || 'Faculty Member',
              department: reg.department || 'Computer Engineering',
              school: reg.school || 'School of Engineering',
              staffType: reg.staffType || 'Teaching',
              roles: isApproved ? [reg.requestedRole || 'Faculty'] : ['Pending Verification'],
              status: reg.status,
              createdOn: reg.createdOn || new Date().toISOString().slice(0, 10),
            })
          })
          return Array.from(map.values())
        })
      }
    } catch {}

    // Also fetch live users from Supabase if accessible
    try {
      const { data: dbUsers, error } = await supabase.from('users').select('*')
      if (dbUsers && dbUsers.length > 0 && !error) {
        setUsers((prev) => {
          const map = new Map(prev.map((u) => [u.empId, u]))
          dbUsers.forEach((dbU: any) => {
            const existing = map.get(dbU.employee_id)
            const fullName = `${dbU.first_name || ''} ${dbU.last_name || ''}`.trim() || 'Staff'
            const isApproved = dbU.account_status === 'Active'
            map.set(dbU.employee_id, {
              id: existing?.id || `usr_db_${dbU.id}`,
              empId: dbU.employee_id,
              name: fullName,
              email: dbU.official_email,
              designation: dbU.designation || 'Faculty Member',
              department: existing?.department || 'Computer Engineering',
              school: existing?.school || 'School of Engineering',
              staffType: (dbU.staff_type as any) || 'Teaching',
              roles: existing?.roles || (isApproved ? ['Faculty'] : ['Pending Verification']),
              status: isApproved ? 'Active' : 'Pending Approval',
              createdOn: dbU.added_on?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            })
          })
          return Array.from(map.values())
        })
      }
    } catch (e) {
      // Gracefully handled if schema not exposed yet
    }
  }

  useEffect(() => {
    syncRegisteredUsers()
    window.addEventListener('pu_user_registered', syncRegisteredUsers)
    return () => window.removeEventListener('pu_user_registered', syncRegisteredUsers)
  }, [])

  const handleApproveUser = async (userId: string) => {
    let approvedName = ''
    let requestedRole = 'Faculty'

    try {
      const stored = localStorage.getItem('pu_registered_users')
      if (stored) {
        const list = JSON.parse(stored)
        const updated = list.map((item: any) => {
          if (item.id === userId) {
            approvedName = item.name
            requestedRole = item.requestedRole || 'Faculty'
            return { ...item, status: 'Active' }
          }
          return item
        })
        localStorage.setItem('pu_registered_users', JSON.stringify(updated))
      }
    } catch {}

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            status: 'Active' as const,
            roles: [requestedRole],
          }
        }
        return u
      })
    )

    triggerToast(`Account for ${approvedName || 'staff member'} verified & activated! They can now sign in.`)
    window.dispatchEvent(new Event('pu_user_approved'))

    // Sync approval to Supabase PostgreSQL accreditation.users table
    try {
      const userToApprove = users.find((u) => u.id === userId)
      if (userToApprove) {
        await supabase
          .from('users')
          .update({ account_status: 'Active' })
          .eq('employee_id', userToApprove.empId)
      }
    } catch (sbErr) {
      console.warn('Supabase approval sync note:', sbErr)
    }
  }

  const handleRejectUser = (userId: string) => {
    let rejectedName = ''
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    try {
      const stored = localStorage.getItem('pu_registered_users')
      if (stored) {
        const list = JSON.parse(stored)
        const updated = list.map((item: any) => {
          if (item.id === userId) {
            rejectedName = item.name
            return { ...item, status: 'Rejected' }
          }
          return item
        })
        localStorage.setItem('pu_registered_users', JSON.stringify(updated))
      }
    } catch {}
    triggerToast(`Registration for ${rejectedName || 'staff'} declined.`)
    window.dispatchEvent(new Event('pu_user_approved'))
  }

  // Active Role Assignment Modal Target
  const [assigningUser, setAssigningUser] = useState<CmsUser | null>(null)
  const [initialModalTab, setInitialModalTab] = useState<'roles' | 'scope'>('roles')

  // Live PostgreSQL Master Data
  const [liveData, setLiveData] = useState<{
    schools: any[]
    departments: any[]
    programmes: any[]
    academic_years: any[]
    records: any[]
    audit_log: any[]
  }>({
    schools: DEMO_SCHOOLS,
    departments: DEMO_DEPARTMENTS,
    programmes: DEMO_PROGRAMMES,
    academic_years: [
      { id: 1, label: 'AY 2025-26', is_current: true },
      { id: 2, label: 'AY 2024-25', is_current: false },
      { id: 3, label: 'AY 2023-24', is_current: false },
    ],
    records: DEMO_RECORDS,
    audit_log: DEMO_AUDIT_LOG,
  })

  const triggerToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Fetch real database records from Supabase / FastAPI backend if live
  const fetchBackendData = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('http://localhost:8000/api/records', {
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        if (data && Array.isArray(data.items)) {
          setLiveData((prev) => ({ ...prev, records: data.items }))
          triggerToast('Live PostgreSQL data synced from Supabase!')
        }
      } else {
        triggerToast('Connected to local cache & Supabase Pooler session')
      }
    } catch (e) {
      triggerToast('Refreshed local session database tables')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Generate flat assignments table from multi-role users
  const assignments: UserRoleAssignment[] = useMemo(() => {
    const list: UserRoleAssignment[] = []
    users.forEach((u) => {
      u.roles.forEach((r, idx) => {
        const def = PDF_ROLES.find((p) => p.name === r)
        const hasScope = u.customScope && idx === 0
        list.push({
          id: `asgn_${u.id}_${idx}`,
          userId: u.id,
          userEmpId: u.empId,
          userName: u.name,
          roleName: r,
          level: (hasScope ? u.customScope?.scopeLevel : def?.level) || 'Institute',
          school: u.school,
          department: u.department,
          validFrom: '2025-06-01',
          validTo: r === 'Reviewer' ? '2026-03-31' : 'Permanent',
          assignedBy: 'Super Admin (Dr. Arvind Gokhale)',
          assignedOn: u.createdOn,
          delegatedPowers: hasScope ? u.customScope?.delegatedPowers : undefined,
          criteriaCoverage: hasScope
            ? `${u.customScope?.allowedDataTypes?.length} of 25 criteria`
            : 'All 25 Criteria',
        })
      })
    })
    return list
  }, [users])

  // Handle saving new roles & dynamic scope for a user
  const handleSaveUserRolesAndScope = (
    userId: string,
    newRoles: string[],
    newScope?: DynamicScopeConfig
  ) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            roles: newRoles,
            customScope: newScope,
          }
        }
        return u
      })
    )
    triggerToast(`Roles & Scope updated for user in PostgreSQL!`)

    // Sync updated roles to localStorage if registered user
    try {
      const stored = localStorage.getItem('pu_registered_users')
      if (stored) {
        const list = JSON.parse(stored)
        const updated = list.map((item: any) => {
          if (item.id === userId) {
            return { ...item, requestedRole: newRoles[0] || item.requestedRole }
          }
          return item
        })
        localStorage.setItem('pu_registered_users', JSON.stringify(updated))
      }
    } catch {}

    // Sync updated roles to Supabase user_role_assignments if connected
    try {
      const targetUser = users.find((u) => u.id === userId)
      if (targetUser) {
        ;(async () => {
          const { data: dbUser } = await supabase
            .from('users')
            .select('id')
            .eq('employee_id', targetUser.empId)
            .maybeSingle()

          if (dbUser?.id) {
            await supabase.from('user_role_assignments').delete().eq('user_id', dbUser.id)
            const { data: allRoles } = await supabase.from('roles').select('id, name')
            if (allRoles) {
              const roleMap = new Map(allRoles.map((r: any) => [r.name, r.id]))
              for (const rName of newRoles) {
                const rId = roleMap.get(rName)
                if (rId) {
                  await supabase.from('user_role_assignments').insert({
                    user_id: dbUser.id,
                    role_id: rId,
                    valid_from: new Date().toISOString().slice(0, 10),
                    assigned_by: 1,
                  })
                }
              }
            }
          }
        })()
      }
    } catch {}
  }

  // Export current table to CSV
  const handleExportCsv = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) return
    const keys = Object.keys(rows[0])
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        keys.join(','),
        ...rows.map((row) =>
          keys
            .map((k) => {
              const val = row[k]
              if (Array.isArray(val)) return `"${val.join('; ')}"`
              if (typeof val === 'object' && val !== null)
                return `"${JSON.stringify(val).replace(/"/g, '""')}"`
              return `"${String(val ?? '').replace(/"/g, '""')}"`
            })
            .join(',')
        ),
      ].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${filename}_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const tables: TableMeta[] = [
    {
      id: 'overview',
      name: 'Database Overview',
      sqlName: 'accreditation.*',
      icon: Database,
      description: 'System-wide summary of 25 criteria modules & PostgreSQL tables',
    },
    {
      id: 'users',
      name: 'Staff & Users',
      sqlName: 'accreditation.users (26)',
      icon: Users,
      badgeCount: users.length,
      description: 'All university personnel, multi-role assignments & dynamic scope allocation',
    },
    {
      id: 'assignments',
      name: 'Role Assignments',
      sqlName: 'accreditation.user_role_assignments (28)',
      icon: ShieldAlert,
      badgeCount: assignments.length,
      description: 'Active role mappings, validity periods, and criteria delegations',
    },
    {
      id: 'roles',
      name: 'Roles & RBAC',
      sqlName: 'accreditation.roles (27)',
      icon: Shield,
      badgeCount: PDF_ROLES.length,
      description: 'The 10 official accreditation roles defined in PDF Section 27',
    },
    {
      id: 'permissions',
      name: 'Role Permissions Matrix',
      sqlName: 'accreditation.role_permissions (29)',
      icon: KeyRound,
      badgeCount: 10,
      description: 'Granular permissions matrix (View, Add, Edit Own, Edit Any, Delete, Submit, Verify, Export, Restricted)',
    },
    {
      id: 'schools',
      name: 'Schools / Faculties',
      sqlName: 'accreditation.schools (30)',
      icon: Building2,
      badgeCount: liveData.schools.length,
      description: 'Constituent academic schools (Engineering, Management, Architecture, Arts)',
    },
    {
      id: 'departments',
      name: 'Departments',
      sqlName: 'accreditation.departments (31)',
      icon: Layers,
      badgeCount: liveData.departments.length,
      description: 'Academic departments, HOD assignments, and criteria coordination units',
    },
    {
      id: 'programmes',
      name: 'Programmes & Degrees',
      sqlName: 'accreditation.programmes (32)',
      icon: GraduationCap,
      badgeCount: liveData.programmes.length,
      description: 'Undergraduate, Postgraduate, and Doctoral programmes under NBA/NAAC',
    },
    {
      id: 'academic_years',
      name: 'Academic Years',
      sqlName: 'accreditation.academic_years (33)',
      icon: Calendar,
      badgeCount: liveData.academic_years.length,
      description: 'Standard institutional accreditation cycles and reporting intervals',
    },
    {
      id: 'records',
      name: 'Accreditation Records',
      sqlName: 'accreditation.records (1-25)',
      icon: FileSpreadsheet,
      badgeCount: liveData.records.length,
      description: 'Evidence records for all 25 criteria modules (faculty, students, research)',
    },
    {
      id: 'audit_log',
      name: 'Audit Trail',
      sqlName: 'accreditation.audit_log (34)',
      icon: History,
      badgeCount: liveData.audit_log.length,
      description: 'Immutable verification, rejection, and role-change audit history',
    },
  ]

  const activeMeta = tables.find((t) => t.id === activeTable) || tables[0]

  return (
    <div className="min-h-screen bg-[#f8f7f4] text-[#251d21] font-sans flex flex-col selection:bg-[#641d31] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-[#641d31] text-white px-4 py-2.5 rounded-lg shadow-xl border border-[#481024] text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={16} className="text-[#ebc992]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pillai University Masthead Topbar (Brand Maroon #561529) */}
      <header className="h-14 border-b border-[#431020] bg-[#561529] text-white px-4 md:px-6 flex items-center justify-between z-30 shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Mobile Sidebar Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-md hover:bg-white/10 text-white/90 hover:text-white transition"
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>

          {/* Desktop Sidebar Collapse Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition items-center justify-center"
            title={sidebarOpen ? 'Collapse Table Navigation' : 'Expand Table Navigation'}
          >
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[#ebc992] text-xs font-semibold transition"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Back to Portal</span>
          </Link>

          <div className="h-4 w-px bg-white/20 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-[#ca9b57] text-[#251d21] flex items-center justify-center font-bold text-sm shadow">
              <Database size={15} />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white">
                PUPortal CMS Studio
              </span>
              <span className="hidden md:inline-block ml-2 text-[11px] font-mono px-2 py-0.5 rounded bg-[#410e1e] text-[#ebc992] border border-[#6b1b33]">
                PostgreSQL · Dynamic Scope Allocation
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-[#ebc992] bg-[#410e1e] border border-[#6b1b33] rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>Supabase Pooler: aws-1-ap-northeast-1</span>
          </div>

          <a
            href="https://supabase.com/dashboard/project/yvzawbvvkwrmkwtvbhkm/editor"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-[#ca9b57] hover:bg-[#b88947] text-[#251d21] shadow transition"
          >
            <span>Supabase Studio</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Navigation Drawer Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left Sidebar Table Navigator */}
        <aside
          className={`
            fixed lg:static top-14 bottom-0 left-0 z-40 bg-white border-r border-[#e8e2e2] flex flex-col shrink-0 transition-all duration-200 shadow-sm
            ${sidebarOpen ? 'w-64' : 'w-0 lg:w-0 overflow-hidden border-r-0'}
            ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <div className="p-3 border-b border-[#e8e2e2] bg-[#faf8f5] flex items-center justify-between">
            <div className="text-[11px] font-bold text-[#641d31] uppercase tracking-wider px-2 py-0.5 flex items-center gap-2">
              <Database size={13} />
              <span>PostgreSQL Tables</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 text-[#6c6065] hover:text-[#251d21]"
            >
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {tables.map((table) => {
              const Icon = table.icon
              const isActive = activeTable === table.id
              return (
                <button
                  key={table.id}
                  onClick={() => {
                    setActiveTable(table.id)
                    setSearchTerm('')
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                    isActive
                      ? 'bg-[#fcf5f7] text-[#641d31] font-bold border-l-4 border-[#641d31] shadow-xs'
                      : 'text-[#4a3e43] hover:bg-[#faf6f7] hover:text-[#641d31]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      size={15}
                      className={isActive ? 'text-[#641d31]' : 'text-[#8c7d83]'}
                    />
                    <span className="truncate">{table.name}</span>
                  </div>
                  {table.badgeCount !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? 'bg-[#641d31] text-white'
                          : 'bg-[#f3f0ea] text-[#6c6065] border border-[#e2dcd2]'
                      }`}
                    >
                      {table.badgeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-[11px] text-[#6c6065] space-y-1.5">
            <div className="flex justify-between">
              <span>Schema</span>
              <span className="font-mono text-[#641d31] font-semibold">accreditation</span>
            </div>
            <div className="flex justify-between">
              <span>Dynamic Scope</span>
              <span className="font-mono text-[#047857] font-semibold">Configurable ✓</span>
            </div>
            <div className="flex justify-between">
              <span>Principal Delegations</span>
              <span className="font-mono text-[#ca9b57] font-semibold">Supported ✓</span>
            </div>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f8f7f4] min-w-0">
          {/* Subheader Toolbar */}
          <div className="min-h-14 border-b border-[#e8e2e2] px-4 md:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#fcf5f7] text-[#641d31] border border-[#f3d7e0] flex items-center justify-center shrink-0">
                <activeMeta.icon size={16} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-[#251d21] leading-tight">
                  {activeMeta.name}
                </h1>
                <p className="text-[11px] font-mono text-[#6c6065]">{activeMeta.sqlName}</p>
              </div>
            </div>

            {activeTable !== 'overview' && (
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Search in table */}
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c7d83]"
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search in table..."
                    className="w-48 sm:w-60 h-8 pl-8 pr-7 bg-[#faf8f5] border border-[#e8e2e2] rounded-md text-xs text-[#251d21] placeholder-[#8c7d83] focus:outline-none focus:border-[#641d31] focus:bg-white transition"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8c7d83] hover:text-[#251d21]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Refresh */}
                <button
                  onClick={fetchBackendData}
                  disabled={isRefreshing}
                  className="h-8 px-2.5 bg-white hover:bg-[#faf8f5] border border-[#e8e2e2] rounded-md text-xs text-[#251d21] hover:text-[#641d31] flex items-center gap-1.5 transition shadow-xs"
                  title="Refresh table"
                >
                  <RefreshCw
                    size={13}
                    className={isRefreshing ? 'animate-spin text-[#641d31]' : ''}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* Export CSV */}
                <button
                  onClick={() => {
                    const dataMap: Record<string, any[]> = {
                      users: users,
                      assignments: assignments,
                      roles: PDF_ROLES,
                      permissions: ROLE_PERMISSIONS_MATRIX,
                      schools: liveData.schools,
                      departments: liveData.departments,
                      programmes: liveData.programmes,
                      academic_years: liveData.academic_years,
                      records: liveData.records,
                      audit_log: liveData.audit_log,
                    }
                    handleExportCsv(activeTable, dataMap[activeTable] || [])
                  }}
                  className="h-8 px-3 bg-white hover:bg-[#fcf5f7] border border-[#e8e2e2] hover:border-[#641d31] rounded-md text-xs text-[#641d31] flex items-center gap-1.5 transition font-semibold shadow-xs"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Responsive Table Display Body */}
          <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
            {activeTable === 'overview' && (
              <OverviewDashboard
                tables={tables}
                usersCount={users.length}
                assignmentsCount={assignments.length}
                liveData={liveData}
                onSelectTable={(id) => setActiveTable(id)}
              />
            )}

            {activeTable === 'users' && (
              <UsersTableView
                users={users}
                search={searchTerm}
                onInspect={setSelectedRow}
                onOpenRoleModal={(u, tab) => {
                  setAssigningUser(u)
                  setInitialModalTab(tab || 'roles')
                }}
                onApproveUser={handleApproveUser}
                onRejectUser={handleRejectUser}
              />
            )}

            {activeTable === 'assignments' && (
              <AssignmentsTableView
                assignments={assignments}
                search={searchTerm}
                onInspect={setSelectedRow}
                onOpenRoleModal={(asgn) => {
                  const target = users.find(
                    (u) => u.id === asgn.userId || u.empId === asgn.userEmpId
                  )
                  if (target) {
                    setAssigningUser(target)
                    setInitialModalTab('scope')
                  }
                }}
              />
            )}

            {activeTable === 'roles' && (
              <RolesTableView
                roles={PDF_ROLES}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'permissions' && (
              <RolePermissionsTableView
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'schools' && (
              <SchoolsTableView
                schools={liveData.schools}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'departments' && (
              <DepartmentsTableView
                departments={liveData.departments}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'programmes' && (
              <ProgrammesTableView
                programmes={liveData.programmes}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'academic_years' && (
              <YearsTableView
                years={liveData.academic_years}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'records' && (
              <RecordsTableView
                records={liveData.records}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}

            {activeTable === 'audit_log' && (
              <AuditLogTableView
                logs={liveData.audit_log}
                search={searchTerm}
                onInspect={setSelectedRow}
              />
            )}
          </div>
        </main>
      </div>

      {/* Role & Dynamic Scope Assignment Modal */}
      {assigningUser && (
        <RoleAndScopeModal
          user={assigningUser}
          initialTab={initialModalTab}
          schools={liveData.schools}
          departments={liveData.departments}
          onClose={() => setAssigningUser(null)}
          onSave={(newRoles, newScope) => {
            handleSaveUserRolesAndScope(assigningUser.id, newRoles, newScope)
            setAssigningUser(null)
          }}
        />
      )}

      {/* Row JSON Inspector Modal */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e8e2e2] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-[#e8e2e2] flex items-center justify-between bg-[#faf8f5]">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-[#641d31]" />
                <h3 className="text-sm font-bold text-[#251d21]">
                  Row JSON Inspection · {activeMeta.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-[#6c6065] hover:text-[#251d21] p-1 rounded hover:bg-[#ede7e2]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-[#1f1a1d] text-[#a7f3d0]">
              <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selectedRow, null, 2)}
              </pre>
            </div>

            <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(selectedRow, null, 2))
                  triggerToast('JSON copied to clipboard!')
                }}
                className="px-3 py-1.5 text-xs bg-white hover:bg-[#f3eee9] border border-[#e8e2e2] rounded-md text-[#251d21] font-semibold transition shadow-xs"
              >
                Copy JSON
              </button>
              <button
                onClick={() => setSelectedRow(null)}
                className="px-4 py-1.5 text-xs bg-[#641d31] hover:bg-[#541629] text-white rounded-md transition font-semibold shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ========================================================================= */
/* Overview Dashboard Component (University Theme)                           */
/* ========================================================================= */
function OverviewDashboard({
  tables,
  usersCount,
  assignmentsCount,
  liveData,
  onSelectTable,
}: {
  tables: TableMeta[]
  usersCount: number
  assignmentsCount: number
  liveData: any
  onSelectTable: (id: TableId) => void
}) {
  const stats = [
    { label: 'Staff Accounts', value: usersCount, icon: Users, color: '#641d31' },
    { label: 'Role Assignments', value: assignmentsCount, icon: ShieldAlert, color: '#ca9b57' },
    { label: 'Schools / Faculties', value: liveData.schools.length, icon: Building2, color: '#047857' },
    { label: 'Academic Departments', value: liveData.departments.length, icon: Layers, color: '#6d28d9' },
    { label: 'Accreditation Records', value: liveData.records.length, icon: FileSpreadsheet, color: '#b91c1c' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome Banner in Pillai Deep Maroon */}
      <div className="bg-gradient-to-r from-[#561529] to-[#641d31] text-white rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md border border-[#481024]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-[#ebc992] font-bold">
              PostgreSQL Schema & Dynamic Scope Active
            </span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Pillai University Accreditation CMS Studio
          </h2>
          <p className="text-xs text-[#fcd4dc] mt-1.5 max-w-xl leading-relaxed">
            Centralized institutional database management studio for master data, staff accounts, multi-role assignments across the 10 official accreditation roles, and dynamic scope allocation.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onSelectTable('users')}
            className="px-4 py-2 bg-[#ca9b57] hover:bg-[#b88947] text-[#251d21] text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
          >
            <KeyRound size={14} />
            <span>Manage User Roles & Scopes</span>
          </button>
          <a
            href="https://supabase.com/dashboard/project/yvzawbvvkwrmkwtvbhkm/editor"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
          >
            <span>Supabase SQL</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon
          return (
            <div
              key={idx}
              className="bg-white border border-[#e8e2e2] rounded-xl p-4 flex flex-col justify-between shadow-xs hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between text-[#6c6065] mb-2">
                <span className="text-xs font-semibold">{s.label}</span>
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <div className="text-2xl font-bold text-[#251d21]">{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* All Tables Grid */}
      <div>
        <h3 className="text-sm font-bold text-[#251d21] mb-3 flex items-center gap-2">
          <Database size={16} className="text-[#641d31]" />
          <span>All Database Tables (Schema: accreditation)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables
            .filter((t) => t.id !== 'overview')
            .map((table) => {
              const Icon = table.icon
              return (
                <div
                  key={table.id}
                  onClick={() => onSelectTable(table.id)}
                  className="bg-white hover:bg-[#fcf7f8] border border-[#e8e2e2] hover:border-[#641d31]/50 rounded-xl p-4 cursor-pointer transition group flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#faf6f7] group-hover:bg-[#641d31] flex items-center justify-center transition">
                        <Icon size={16} className="text-[#641d31] group-hover:text-white" />
                      </div>
                      {table.badgeCount !== undefined && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#faf8f5] border border-[#e8e2e2] text-[#6c6065]">
                          {table.badgeCount} rows
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#251d21] group-hover:text-[#641d31] transition">
                      {table.name}
                    </h4>
                    <p className="text-[11px] font-mono text-[#8c7d83] mt-0.5">
                      {table.sqlName}
                    </p>
                    <p className="text-xs text-[#6c6065] mt-2 line-clamp-2 leading-relaxed">
                      {table.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#f0ece9] flex items-center justify-between text-xs text-[#641d31] font-semibold">
                    <span>Browse table</span>
                    <ChevronRight size={14} className="group-hover:translate-x-1 transition" />
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Combined Role & Dynamic Scope Allocation Modal (University Theme)         */
/* ========================================================================= */
function RoleAndScopeModal({
  user,
  initialTab = 'roles',
  schools,
  departments,
  onClose,
  onSave,
}: {
  user: CmsUser
  initialTab?: 'roles' | 'scope'
  schools: any[]
  departments: any[]
  onClose: () => void
  onSave: (newRoles: string[], newScope?: DynamicScopeConfig) => void
}) {
  const [activeTab, setActiveTab] = useState<'roles' | 'scope'>(initialTab)
  const [currentRoles, setCurrentRoles] = useState<string[]>([...user.roles])
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState<string>('')

  // Dynamic Scope states
  const [enableCustomScope, setEnableCustomScope] = useState<boolean>(Boolean(user.customScope))
  const [customScopeLevel, setCustomScopeLevel] = useState<'Institute' | 'School' | 'Department' | 'Own Records'>(
    user.customScope?.scopeLevel ||
      (user.roles.includes('Dean')
        ? 'School'
        : user.roles.includes('HOD')
        ? 'Department'
        : 'Department')
  )
  const [scopeSchool, setScopeSchool] = useState<string>(
    user.customScope?.school || user.school || 'School of Engineering'
  )
  const [scopeDept, setScopeDept] = useState<string>(
    user.customScope?.department || user.department || 'Computer Engineering'
  )

  // Granular Delegated Powers from Principal/IQAC
  const [delegatedCanExport, setDelegatedCanExport] = useState<boolean>(
    user.customScope?.canExport ??
      user.roles.some((r) => r.includes('Principal') || r.includes('IQAC Coordinator'))
  )
  const [delegatedCanRestricted, setDelegatedCanRestricted] = useState<boolean>(
    user.customScope?.canSeeRestricted ??
      user.roles.some((r) => r.includes('Principal') || r.includes('IQAC Coordinator'))
  )
  const [delegatedCanVerify, setDelegatedCanVerify] = useState<boolean>(
    user.customScope?.canVerify ??
      user.roles.some(
        (r) =>
          r.includes('Principal') ||
          r.includes('IQAC') ||
          r.includes('Dean') ||
          r.includes('HOD')
      )
  )
  const [delegatedCanFinalApprove, setDelegatedCanFinalApprove] = useState<boolean>(
    user.customScope?.canFinalApprove ?? user.roles.includes('Principal / Director')
  )

  // 25 Criteria Modules allocated (Table 28 in PDF)
  const [allocatedCriteria, setAllocatedCriteria] = useState<number[]>(
    user.customScope?.allowedDataTypes || Array.from({ length: 25 }, (_, i) => i + 1)
  )

  const roleDef = PDF_ROLES.find((r) => r.name === selectedRoleToAdd)

  // Dynamic assembled config for live preview
  const currentCustomScopeObj: DynamicScopeConfig | undefined = useMemo(() => {
    if (!enableCustomScope) return undefined
    return {
      scopeLevel: customScopeLevel,
      school: scopeSchool,
      department: scopeDept,
      canVerify: delegatedCanVerify,
      canExport: delegatedCanExport,
      canSeeRestricted: delegatedCanRestricted,
      canFinalApprove: delegatedCanFinalApprove,
      allowedDataTypes: allocatedCriteria,
      delegatedFrom: 'Principal / Director',
      delegationLabel: `Delegated Scope: ${customScopeLevel} (${allocatedCriteria.length}/25 Criteria)`,
    }
  }, [
    enableCustomScope,
    customScopeLevel,
    scopeSchool,
    scopeDept,
    delegatedCanVerify,
    delegatedCanExport,
    delegatedCanRestricted,
    delegatedCanFinalApprove,
    allocatedCriteria,
  ])

  const effectiveCaps = useMemo(
    () => computeUserCapabilities(currentRoles, currentCustomScopeObj),
    [currentRoles, currentCustomScopeObj]
  )

  const handleAddRole = () => {
    if (!selectedRoleToAdd) return
    if (currentRoles.includes(selectedRoleToAdd)) return
    setCurrentRoles([...currentRoles, selectedRoleToAdd])
    setSelectedRoleToAdd('')
  }

  const handleRemoveRole = (roleToRemove: string) => {
    if (currentRoles.length === 1) {
      alert('A user must have at least one active role in the accreditation system.')
      return
    }
    setCurrentRoles(currentRoles.filter((r) => r !== roleToRemove))
  }

  const handleToggleRole = (roleName: string) => {
    if (currentRoles.includes(roleName)) {
      if (currentRoles.length === 1) {
        alert('A user must have at least one role assigned.')
        return
      }
      setCurrentRoles(currentRoles.filter((r) => r !== roleName))
    } else {
      setCurrentRoles([...currentRoles, roleName])
    }
  }

  const handleToggleCriteria = (id: number) => {
    if (allocatedCriteria.includes(id)) {
      if (allocatedCriteria.length === 1) {
        alert('User must be allocated at least one criteria module.')
        return
      }
      setAllocatedCriteria(allocatedCriteria.filter((c) => c !== id))
    } else {
      setAllocatedCriteria([...allocatedCriteria, id].sort((a, b) => a - b))
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-4">
      <div className="bg-white border border-[#e8e2e2] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#431020] bg-[#561529] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ca9b57] text-[#251d21] flex items-center justify-center font-bold shadow">
              <KeyRound size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Role & Dynamic Scope Studio · {user.name}
              </h2>
              <p className="text-xs text-[#fcd4dc]">
                Assign multiple roles and dynamically delegate specific Principal powers & criteria scopes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 bg-[#faf8f5] border-b border-[#e8e2e2] flex gap-4 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`pb-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'roles'
                ? 'border-[#641d31] text-[#641d31]'
                : 'border-transparent text-[#6c6065] hover:text-[#251d21]'
            }`}
          >
            <Shield size={14} />
            <span>1. Standard Roles (10 Roles)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#f0ece9] text-[10px] font-mono">
              {currentRoles.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scope')}
            className={`pb-3 text-xs font-bold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'scope'
                ? 'border-[#ca9b57] text-[#93641b]'
                : 'border-transparent text-[#6c6065] hover:text-[#251d21]'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>2. Dynamic Scope Allocation & Principal Delegations</span>
            {enableCustomScope && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#fdf3e2] text-[#ca9b57] text-[10px] font-mono border border-[#edd7b4]">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-5 bg-[#f8f7f4]">
          {/* User Profile Card */}
          <div className="bg-white border border-[#e8e2e2] rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-full bg-[#fcf5f7] border border-[#f3d7e0] flex items-center justify-center text-[#641d31] font-bold text-base">
                {user.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
              </div>
              <div>
                <div className="text-sm font-bold text-[#251d21] flex items-center gap-2 flex-wrap">
                  <span>{user.name}</span>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#faf8f5] text-[#641d31] border border-[#e8e2e2]">
                    {user.empId}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] font-semibold">
                    {user.staffType}
                  </span>
                </div>
                <div className="text-xs text-[#6c6065] mt-0.5">
                  {user.email} · {user.department} ({user.school})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-left md:text-right">
                <span className="text-[11px] text-[#6c6065] block font-medium">Assigned Roles</span>
                <span className="text-xs font-bold text-[#641d31]">
                  {currentRoles.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: STANDARD ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-5">
              {/* Effective Capabilities Matrix */}
              <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles size={17} className="text-[#641d31]" />
                    <h3 className="text-xs font-bold text-[#251d21] uppercase tracking-wider">
                      What This User Is Capable Of Doing (Effective Permissions)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#faf8f5] text-[#ca9b57] border border-[#edd7b4] font-semibold">
                    Scope: {effectiveCaps.highestScope} Level
                  </span>
                </div>

                {/* Capability Badges Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-3 ${
                      effectiveCaps.canVerify
                        ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#047857]'
                        : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                    }`}
                  >
                    <FileCheck size={18} className="shrink-0" />
                    <div>
                      <div className="text-xs font-bold">
                        {effectiveCaps.canVerify ? 'Can Verify Records' : 'Cannot Verify'}
                      </div>
                      <div className="text-[10px] opacity-90">
                        {effectiveCaps.canVerify
                          ? `Verification active (${effectiveCaps.highestScope})`
                          : 'No verification rights'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border flex items-center gap-3 ${
                      effectiveCaps.canExport
                        ? 'bg-[#eff6ff] border-[#bfdbfe] text-[#1d4ed8]'
                        : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                    }`}
                  >
                    <Download size={18} className="shrink-0" />
                    <div>
                      <div className="text-xs font-bold">
                        {effectiveCaps.canExport ? 'Can Export Reports' : 'No Export Access'}
                      </div>
                      <div className="text-[10px] opacity-90">
                        {effectiveCaps.canExport
                          ? 'NAAC / NBA / NIRF exports'
                          : 'Export restricted to Principal/IQAC'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border flex items-center gap-3 ${
                      effectiveCaps.canSeeRestricted
                        ? 'bg-[#fffbeb] border-[#fde68a] text-[#b45309]'
                        : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                    }`}
                  >
                    {effectiveCaps.canSeeRestricted ? (
                      <Unlock size={18} className="shrink-0" />
                    ) : (
                      <Lock size={18} className="shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold">
                        {effectiveCaps.canSeeRestricted
                          ? 'Restricted Fields Visible'
                          : 'Masked Private Fields'}
                      </div>
                      <div className="text-[10px] opacity-90">
                        {effectiveCaps.canSeeRestricted
                          ? 'Financial amounts & private data'
                          : 'Confidential privacy mode'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specific PDF What They Do */}
                <div className="space-y-2 pt-2 border-t border-[#f0ece9]">
                  <div className="text-[11px] font-bold text-[#6c6065] uppercase tracking-wider">
                    Official Duties for Assigned Roles (PDF Specification Section 27):
                  </div>
                  <div className="space-y-2">
                    {effectiveCaps.whatTheyDoList.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#faf8f5] border border-[#e8e2e2] text-xs flex items-start gap-2.5"
                      >
                        <span className="px-2 py-0.5 rounded bg-[#641d31] text-white text-[10px] font-bold shrink-0 mt-0.5">
                          {item.role}
                        </span>
                        <span className="text-[#251d21] leading-relaxed">
                          <strong>What they do:</strong> {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dropdown Selector to Add Role */}
              <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus size={16} className="text-[#641d31]" />
                    <h3 className="text-xs font-bold text-[#251d21] uppercase tracking-wider">
                      Add Role via Dropdown (Table 27 Specifications)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#6c6065]">Select Role</label>
                    <select
                      value={selectedRoleToAdd}
                      onChange={(e) => setSelectedRoleToAdd(e.target.value)}
                      className="w-full h-9 px-3 bg-[#faf8f5] border border-[#e8e2e2] rounded-lg text-xs text-[#251d21] focus:outline-none focus:border-[#641d31] focus:bg-white"
                    >
                      <option value="">-- Choose from 10 Roles --</option>
                      <optgroup label="Institute-Level Roles">
                        <option value="Super Admin">1. Super Admin (Institute)</option>
                        <option value="Principal / Director">2. Principal / Director (Institute)</option>
                        <option value="IQAC Coordinator">3. IQAC Coordinator (Institute)</option>
                        <option value="IQAC Member">4. IQAC Member (Institute)</option>
                        <option value="Reviewer">10. Reviewer (Institute, Audit)</option>
                      </optgroup>
                      <optgroup label="School-Level Roles">
                        <option value="Dean">5. Dean (School)</option>
                      </optgroup>
                      <optgroup label="Department-Level Roles">
                        <option value="HOD">6. HOD (Department)</option>
                        <option value="Department Coordinator">7. Department Coordinator (Department)</option>
                      </optgroup>
                      <optgroup label="Own Records Roles">
                        <option value="Faculty">8. Faculty (Own Records)</option>
                        <option value="Non-teaching Staff">9. Non-teaching Staff (Own Records)</option>
                      </optgroup>
                    </select>
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={handleAddRole}
                      disabled={!selectedRoleToAdd || currentRoles.includes(selectedRoleToAdd)}
                      className="w-full h-9 px-4 bg-[#641d31] hover:bg-[#541629] disabled:bg-[#f0ece9] disabled:text-[#8c7d83] text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Plus size={15} />
                      <span>Add Role to User</span>
                    </button>
                  </div>
                </div>

                {roleDef && (
                  <div className="p-3.5 rounded-lg bg-[#faf8f5] border border-[#e8e2e2] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#641d31] text-xs flex items-center gap-1.5">
                        <Shield size={14} />
                        {roleDef.name} ({roleDef.level} Level)
                      </span>
                      <div className="flex gap-2">
                        {roleDef.can_verify && (
                          <span className="text-[10px] font-semibold text-[#047857] bg-[#ecfdf5] border border-[#a7f3d0] px-1.5 py-0.5 rounded">
                            ✓ Can Verify
                          </span>
                        )}
                        {roleDef.can_export && (
                          <span className="text-[10px] font-semibold text-[#1d4ed8] bg-[#eff6ff] border border-[#bfdbfe] px-1.5 py-0.5 rounded">
                            ✓ Can Export
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[#251d21]">
                      <strong>What they do:</strong> {roleDef.whatTheyDo}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Toggle of All 10 Roles */}
              <div>
                <label className="text-xs font-bold text-[#251d21] uppercase tracking-wider block mb-2.5">
                  Quick Toggle & Compare All 10 Roles
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {PDF_ROLES.map((r) => {
                    const isAssigned = currentRoles.includes(r.name)
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleToggleRole(r.name)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between gap-2 ${
                          isAssigned
                            ? 'bg-[#fcf5f7] border-[#641d31] text-[#251d21] shadow-xs'
                            : 'bg-white border-[#e8e2e2] text-[#6c6065] hover:border-[#ca9b57]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center text-xs shrink-0 ${
                                isAssigned ? 'bg-[#641d31] text-white' : 'border border-[#d0c9c7]'
                              }`}
                            >
                              {isAssigned && <Check size={11} strokeWidth={3} />}
                            </div>
                            <span className="font-bold text-xs text-[#251d21]">{r.name}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#faf8f5] text-[#ca9b57] border border-[#edd7b4] font-semibold">
                            {r.level}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6c6065] leading-snug pl-6">
                          {r.whatTheyDo}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DYNAMIC SCOPE ALLOCATION & PRINCIPAL DELEGATIONS */}
          {activeTab === 'scope' && (
            <div className="space-y-5">
              {/* Dynamic Scope Enable Banner */}
              <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal size={18} className="text-[#ca9b57]" />
                    <div>
                      <h3 className="text-sm font-bold text-[#251d21]">
                        Dynamic Scope & Specific Power Delegation
                      </h3>
                      <p className="text-xs text-[#6c6065]">
                        Allows an administrator to take a user with any role (e.g. HOD) and delegate specific powers from Principal / Director (e.g. Export Reports only, Restricted Data only, or specific Criteria Modules).
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={enableCustomScope}
                      onChange={(e) => setEnableCustomScope(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#d0c9c7] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#641d31]"></div>
                  </label>
                </div>
              </div>

              {enableCustomScope ? (
                <>
                  {/* Step A: Scope Hierarchy Level Override */}
                  <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center gap-2">
                      <Layers size={16} className="text-[#641d31]" />
                      <h4 className="text-xs font-bold text-[#251d21] uppercase tracking-wider">
                        1. Allocated Scope Level (Hierarchy Boundary)
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                      {(['Institute', 'School', 'Department', 'Own Records'] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setCustomScopeLevel(lvl)}
                          className={`p-3 rounded-lg border text-xs font-semibold text-center transition ${
                            customScopeLevel === lvl
                              ? 'bg-[#fcf5f7] border-[#641d31] text-[#641d31] shadow-xs'
                              : 'bg-[#faf8f5] border-[#e8e2e2] text-[#6c6065] hover:border-[#ca9b57]'
                          }`}
                        >
                          <div className="text-sm font-bold">{lvl}</div>
                          <div className="text-[10px] text-[#8c7d83] mt-0.5">
                            {lvl === 'Institute'
                              ? 'Entire University (Principal Level)'
                              : lvl === 'School'
                              ? 'Constituent School (Dean Level)'
                              : lvl === 'Department'
                              ? 'Department (HOD Level)'
                              : 'Personal Records Only'}
                          </div>
                        </button>
                      ))}
                    </div>

                    {customScopeLevel === 'School' && (
                      <div className="pt-2">
                        <label className="text-[11px] font-bold text-[#6c6065] block mb-1">
                          Select Specific School Scope:
                        </label>
                        <select
                          value={scopeSchool}
                          onChange={(e) => setScopeSchool(e.target.value)}
                          className="w-full h-9 px-3 bg-[#faf8f5] border border-[#e8e2e2] rounded-lg text-xs text-[#251d21] focus:outline-none focus:border-[#641d31]"
                        >
                          {schools.map((s) => (
                            <option key={s.id} value={s.name}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {customScopeLevel === 'Department' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-[11px] font-bold text-[#6c6065] block mb-1">
                            School:
                          </label>
                          <select
                            value={scopeSchool}
                            onChange={(e) => setScopeSchool(e.target.value)}
                            className="w-full h-9 px-3 bg-[#faf8f5] border border-[#e8e2e2] rounded-lg text-xs text-[#251d21] focus:outline-none focus:border-[#641d31]"
                          >
                            {schools.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-[#6c6065] block mb-1">
                            Department:
                          </label>
                          <select
                            value={scopeDept}
                            onChange={(e) => setScopeDept(e.target.value)}
                            className="w-full h-9 px-3 bg-[#faf8f5] border border-[#e8e2e2] rounded-lg text-xs text-[#251d21] focus:outline-none focus:border-[#641d31]"
                          >
                            {departments.map((d) => (
                              <option key={d.id} value={d.name}>
                                {d.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step B: Specific Delegated Capabilities (Pick & Choose from Principal) */}
                  <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound size={16} className="text-[#ca9b57]" />
                        <h4 className="text-xs font-bold text-[#251d21] uppercase tracking-wider">
                          2. Granular Power Delegations (Delegate from Principal / Director)
                        </h4>
                      </div>
                      <span className="text-[10px] text-[#93641b] bg-[#fdf3e2] border border-[#edd7b4] px-2 py-0.5 rounded font-bold">
                        Principal Powers
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Power 1: Export Reports */}
                      <div
                        onClick={() => setDelegatedCanExport(!delegatedCanExport)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          delegatedCanExport
                            ? 'bg-[#eff6ff] border-[#bfdbfe] text-[#251d21]'
                            : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                            delegatedCanExport ? 'bg-[#1d4ed8] text-white' : 'border border-[#d0c9c7]'
                          }`}
                        >
                          {delegatedCanExport && <Check size={13} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>Can Export Reports</span>
                            <span className="text-[10px] text-[#1d4ed8] bg-[#eff6ff] px-1.5 py-0.2 rounded font-mono font-semibold">
                              Principal / IQAC Only
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6c6065] mt-1 leading-relaxed">
                            Allows this HOD/staff to generate & download official NAAC, NBA, and consolidated criteria spreadsheets.
                          </p>
                        </div>
                      </div>

                      {/* Power 2: Restricted Data Access */}
                      <div
                        onClick={() => setDelegatedCanRestricted(!delegatedCanRestricted)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          delegatedCanRestricted
                            ? 'bg-[#fffbeb] border-[#fde68a] text-[#251d21]'
                            : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                            delegatedCanRestricted ? 'bg-[#b45309] text-white' : 'border border-[#d0c9c7]'
                          }`}
                        >
                          {delegatedCanRestricted && <Check size={13} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>Can See Restricted Fields</span>
                            <span className="text-[10px] text-[#b45309] bg-[#fffbeb] px-1.5 py-0.2 rounded font-mono font-semibold">
                              Principal / IQAC Only
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6c6065] mt-1 leading-relaxed">
                            Unmasks confidential fields like student stipend amounts, faculty consultancy shares, private phone numbers, and patents.
                          </p>
                        </div>
                      </div>

                      {/* Power 3: Final Institutional Sign-off */}
                      <div
                        onClick={() => setDelegatedCanFinalApprove(!delegatedCanFinalApprove)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          delegatedCanFinalApprove
                            ? 'bg-[#fcf5f7] border-[#641d31] text-[#251d21]'
                            : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                            delegatedCanFinalApprove ? 'bg-[#641d31] text-white' : 'border border-[#d0c9c7]'
                          }`}
                        >
                          {delegatedCanFinalApprove && <Check size={13} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>Final Institutional Approval</span>
                            <span className="text-[10px] text-[#641d31] bg-[#fcf5f7] border border-[#f3d7e0] px-1.5 py-0.2 rounded font-mono font-semibold">
                              Principal Only
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6c6065] mt-1 leading-relaxed">
                            Delegates the Principal's authority to grant final university sign-off on completed accreditation criteria.
                          </p>
                        </div>
                      </div>

                      {/* Power 4: Record Verification Power */}
                      <div
                        onClick={() => setDelegatedCanVerify(!delegatedCanVerify)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          delegatedCanVerify
                            ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#251d21]'
                            : 'bg-[#faf8f5] border-[#e8e2e2] text-[#8c7d83]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center text-xs mt-0.5 shrink-0 ${
                            delegatedCanVerify ? 'bg-[#047857] text-white' : 'border border-[#d0c9c7]'
                          }`}
                        >
                          {delegatedCanVerify && <Check size={13} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>Can Verify Records</span>
                            <span className="text-[10px] text-[#047857] bg-[#ecfdf5] px-1.5 py-0.2 rounded font-mono font-semibold">
                              Verifier
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6c6065] mt-1 leading-relaxed">
                            Grants authority to inspect proofs, verify submitted records, or reject back to draft with mandatory remarks.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step C: Criteria Data Types Covered (PDF Table 28 Specification) */}
                  <div className="bg-white border border-[#e8e2e2] rounded-xl p-5 space-y-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-[#641d31]" />
                        <h4 className="text-xs font-bold text-[#251d21] uppercase tracking-wider">
                          3. Criteria Modules Covered (Table 28: Data Types Covered)
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAllocatedCriteria(Array.from({ length: 25 }, (_, i) => i + 1))}
                          className="px-2 py-1 text-[10px] bg-[#faf8f5] hover:bg-[#f0ece9] text-[#251d21] font-semibold rounded border border-[#e8e2e2]"
                        >
                          All 25 Criteria
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllocatedCriteria([11, 12, 13, 14, 15, 16, 25])}
                          className="px-2 py-1 text-[10px] bg-[#fcf5f7] hover:bg-[#f5e7ec] text-[#641d31] font-semibold rounded border border-[#f3d7e0]"
                        >
                          Research Only (11-16)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllocatedCriteria([1, 2, 3, 4, 5, 6, 7])}
                          className="px-2 py-1 text-[10px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] font-semibold rounded border border-[#a7f3d0]"
                        >
                          Students Only (1-7)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAllocatedCriteria([1])}
                          className="px-2 py-1 text-[10px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#b91c1c] font-semibold rounded border border-[#fecaca]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-[#6c6065]">
                      Select the specific accreditation modules this user is authorized to manage:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {CRITERIA_MODULES_25.map((mod) => {
                        const isSelected = allocatedCriteria.includes(mod.id)
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => handleToggleCriteria(mod.id)}
                            className={`p-2 rounded-lg border text-left text-xs transition flex items-center justify-between gap-1.5 ${
                              isSelected
                                ? 'bg-[#fcf5f7] border-[#641d31] text-[#641d31] font-semibold shadow-xs'
                                : 'bg-[#faf8f5] border-[#e8e2e2] text-[#6c6065] hover:border-[#ca9b57]'
                            }`}
                          >
                            <span className="truncate">
                              <span className="font-mono text-[10px] opacity-70 mr-1">
                                {mod.id}.
                              </span>
                              {mod.name}
                            </span>
                            {isSelected && <Check size={12} className="text-[#641d31] shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Step D: Live Simulation / Audit Banner */}
                  <div className="bg-[#faf8f5] border border-[#ca9b57]/50 rounded-xl p-4 flex items-start gap-3">
                    <Sparkles size={18} className="text-[#ca9b57] shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-[#251d21]">
                        ⚡ Dynamic Scope Summary for {user.name}:
                      </div>
                      <p className="text-[#6c6065] leading-relaxed">
                        User holds role <strong>[{currentRoles.join(', ')}]</strong>. Scope is dynamically allocated to <strong>{customScopeLevel} Level</strong> ({customScopeLevel === 'Department' ? scopeDept : customScopeLevel === 'School' ? scopeSchool : 'All University'}).
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {delegatedCanExport && (
                          <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] font-semibold text-[10px]">
                            ✓ Delegated Principal Power: Export NAAC/NBA Reports
                          </span>
                        )}
                        {delegatedCanRestricted && (
                          <span className="px-2 py-0.5 rounded bg-[#fffbeb] text-[#b45309] border border-[#fde68a] font-semibold text-[10px]">
                            ✓ Delegated Principal Power: View Confidential Fields
                          </span>
                        )}
                        {delegatedCanFinalApprove && (
                          <span className="px-2 py-0.5 rounded bg-[#fcf5f7] text-[#641d31] border border-[#f3d7e0] font-semibold text-[10px]">
                            ✓ Delegated Principal Power: Final Institutional Sign-off
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-white text-[#6c6065] border border-[#e8e2e2] text-[10px] font-mono">
                          {allocatedCriteria.length} of 25 Criteria Modules Authorized
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center bg-white border border-[#e8e2e2] rounded-xl text-xs text-[#6c6065] space-y-2 shadow-xs">
                  <Sliders size={24} className="mx-auto text-[#ca9b57]" />
                  <p className="font-bold text-[#251d21]">
                    Standard Default Scope Active
                  </p>
                  <p className="max-w-md mx-auto leading-relaxed">
                    This user follows standard role constraints from the PDF specification. Toggle the switch above to enable custom dynamic scope allocation and delegate specific Principal powers.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#e8e2e2] bg-[#faf8f5] flex items-center justify-between">
          <span className="text-xs text-[#6c6065]">
            {enableCustomScope ? 'Dynamic Scope will be saved to PostgreSQL session.' : 'Standard scope will apply.'}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold bg-white hover:bg-[#f0ece9] border border-[#e8e2e2] text-[#251d21] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(currentRoles, currentCustomScopeObj)}
              className="px-5 py-2 text-xs font-bold bg-[#641d31] hover:bg-[#541629] text-white rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} className="text-[#ebc992]" />
              <span>Apply & Save Dynamic Scope</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Users Table View with Multi-Role Display & Dynamic Scope Badges          */
/* ========================================================================= */
function UsersTableView({
  users,
  search,
  onInspect,
  onOpenRoleModal,
  onApproveUser,
  onRejectUser,
}: {
  users: CmsUser[]
  search: string
  onInspect: (r: any) => void
  onOpenRoleModal: (u: CmsUser, tab?: 'roles' | 'scope') => void
  onApproveUser?: (userId: string) => void
  onRejectUser?: (userId: string) => void
}) {
  const pendingUsers = users.filter((u) => u.status === 'Pending Approval')

  const filtered = users.filter((u) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.empId.toLowerCase().includes(term) ||
      u.roles.some((r) => r.toLowerCase().includes(term)) ||
      u.department.toLowerCase().includes(term)
    )
  })

  const getRoleBadgeStyle = (role: string) => {
    if (role.includes('Admin') || role.includes('Principal')) {
      return 'bg-[#fcf5f7] text-[#641d31] border-[#f3d7e0]'
    }
    if (role.includes('IQAC')) {
      return 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
    }
    if (role.includes('Dean') || role.includes('HOD')) {
      return 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
    }
    if (role.includes('Coordinator')) {
      return 'bg-[#fffbeb] text-[#b45309] border-[#fde68a]'
    }
    return 'bg-[#f3f4f6] text-[#374151] border-[#e5e7eb]'
  }

  return (
    <div className="space-y-4">
      {/* Pending Approval Alert & Quick Review Banner for Super Admin */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#fffbeb] border border-[#f59e0b] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#fde68a]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-ping" />
              <h3 className="font-bold text-[#92400e] text-xs sm:text-sm flex items-center gap-2">
                <Clock size={16} className="text-[#d97706]" />
                <span>Pending Staff Registrations Awaiting Super Admin Acceptance ({pendingUsers.length})</span>
              </h3>
            </div>
            <span className="text-[10px] font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded-full border border-[#fde68a] uppercase tracking-wider">
              Verification Queue
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {pendingUsers.map((pUser) => (
              <div
                key={pUser.id}
                className="bg-white border border-[#fde68a] rounded-lg p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#251d21] text-xs sm:text-sm">{pUser.name}</span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#f3f0ea] text-[#641d31] font-bold border border-[#e2dcd2]">
                      {pUser.empId}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]">
                      Requested: {pUser.roles[0] || 'Faculty'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6c6065] flex flex-wrap items-center gap-2 sm:gap-3">
                    <span><strong>Email:</strong> {pUser.email}</span>
                    <span>•</span>
                    <span><strong>Designation:</strong> {pUser.designation}</span>
                    <span>•</span>
                    <span><strong>Dept:</strong> {pUser.department}</span>
                    <span>•</span>
                    <span><strong>School:</strong> {pUser.school}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {onApproveUser && (
                    <button
                      type="button"
                      onClick={() => onApproveUser(pUser.id)}
                      className="px-3 py-1.5 bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition shadow-xs"
                    >
                      <CheckCircle2 size={13} />
                      <span>Verify & Accept</span>
                    </button>
                  )}
                  {onRejectUser && (
                    <button
                      type="button"
                      onClick={() => onRejectUser(pUser.id)}
                      className="px-2.5 py-1.5 bg-white hover:bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] text-xs font-semibold rounded-md flex items-center gap-1 transition shadow-xs"
                    >
                      <XCircle size={13} />
                      <span>Decline</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onInspect(pUser)}
                    className="p-1.5 rounded hover:bg-[#f3f0ea] text-[#6c6065] hover:text-[#251d21] transition"
                    title="Inspect Registration Details"
                  >
                    <Eye size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[1150px] border-collapse">
            <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 min-w-[110px]">Emp ID</th>
                <th className="px-4 py-3 min-w-[200px]">Staff Name</th>
                <th className="px-4 py-3 min-w-[180px]">Official Email</th>
                <th className="px-4 py-3 min-w-[180px]">Assigned Roles</th>
                <th className="px-4 py-3 min-w-[200px]">Scope & Principal Delegations</th>
                <th className="px-4 py-3 min-w-[210px]">Effective Capabilities</th>
                <th className="px-4 py-3 min-w-[160px]">Department</th>
                <th className="px-4 py-3 min-w-[100px]">Status</th>
                <th className="px-4 py-3 min-w-[160px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0ece9]">
              {filtered.map((user) => {
                const isPending = user.status === 'Pending Approval'
                const caps = computeUserCapabilities(user.roles, user.customScope)
                const hasDelegation = Boolean(user.customScope)

                return (
                  <tr key={user.id} className={isPending ? 'bg-[#fffdfa] hover:bg-[#fff9f0] transition' : 'hover:bg-[#fcf7f8] transition'}>
                    <td className="px-4 py-3 font-mono text-[#641d31] font-bold whitespace-nowrap">
                      {user.empId}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#251d21]">
                      <div className="font-bold text-[#251d21]">{user.name}</div>
                      <div className="text-[11px] text-[#6c6065]">{user.designation}</div>
                    </td>
                    <td className="px-4 py-3 text-[#6c6065] font-mono text-[11px]">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                        {user.roles.map((r) => (
                          <span
                            key={r}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRoleBadgeStyle(
                              r
                            )}`}
                          >
                            {r}
                          </span>
                        ))}
                        {!isPending && (
                          <button
                            type="button"
                            onClick={() => onOpenRoleModal(user, 'roles')}
                            className="px-1.5 py-0.5 rounded bg-white hover:bg-[#fcf5f7] text-[#641d31] border border-[#e8e2e2] text-[10px] font-bold flex items-center gap-1 transition shadow-2xs"
                            title="Add or remove roles for this user"
                          >
                            <Plus size={10} />
                            <span>Assign</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Scope & Principal Delegations Column */}
                    <td className="px-4 py-3">
                      {hasDelegation ? (
                        <div className="space-y-1 max-w-xs">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#fdf3e2] text-[#93641b] border border-[#edd7b4] text-[10px] font-bold">
                            <SlidersHorizontal size={10} />
                            <span>Dynamic Scope: {caps.highestScope}</span>
                          </span>
                          {caps.delegatedPowers.length > 0 && (
                            <div className="text-[10px] text-[#047857] font-semibold leading-tight">
                              ⚡ {caps.delegatedPowers[0]}
                            </div>
                          )}
                          <div className="text-[10px] text-[#6c6065]">
                            Criteria: {caps.allowedDataTypes.length} of 25 modules
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#6c6065]">
                          <span className="px-1.5 py-0.5 rounded bg-[#faf8f5] border border-[#e8e2e2] text-[10px] font-mono">
                            Standard ({caps.highestScope})
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Effective Capabilities Column */}
                    <td className="px-4 py-3">
                      <div className="space-y-1 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {caps.canVerify && (
                            <span className="px-1.5 py-0.5 rounded bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] text-[10px] font-bold">
                              ✓ Verify
                            </span>
                          )}
                          {caps.canExport && (
                            <span className="px-1.5 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] text-[10px] font-bold">
                              ✓ Export
                            </span>
                          )}
                          {caps.canSeeRestricted && (
                            <span className="px-1.5 py-0.5 rounded bg-[#fffbeb] text-[#b45309] border border-[#fde68a] text-[10px] font-bold">
                              ✓ Restricted
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[11px] text-[#6c6065] truncate leading-tight"
                          title={caps.whatTheyDoList.map((w) => `${w.role}: ${w.text}`).join(' | ')}
                        >
                          {caps.whatTheyDoList[0]?.text || 'Standard staff user'}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[#251d21]">
                      <div className="font-medium">{user.department}</div>
                      <div className="text-[10px] text-[#6c6065]">{user.school}</div>
                    </td>

                    <td className="px-4 py-3">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#fef3c7] text-[#b45309] border border-[#fde68a] text-[10px] font-bold whitespace-nowrap">
                          <Clock size={10} className="text-[#d97706]" />
                          <span>Pending Approval</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] text-[10px] font-bold whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                          <span>{user.status}</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPending ? (
                          <>
                            {onApproveUser && (
                              <button
                                type="button"
                                onClick={() => onApproveUser(user.id)}
                                className="px-2.5 py-1 rounded bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                                title="Cross-verify & Activate this user"
                              >
                                <CheckCircle2 size={12} />
                                <span>Accept</span>
                              </button>
                            )}
                            {onRejectUser && (
                              <button
                                type="button"
                                onClick={() => onRejectUser(user.id)}
                                className="px-2 py-1 rounded bg-white hover:bg-[#fee2e2] text-[#b91c1c] border border-[#fca5a5] text-xs font-semibold transition flex items-center gap-1 shadow-2xs"
                                title="Decline registration"
                              >
                                <XCircle size={12} />
                                <span>Decline</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onOpenRoleModal(user, 'scope')}
                              className="px-2 py-1 rounded bg-[#fdf3e2] hover:bg-[#faebd1] text-[#93641b] border border-[#edd7b4] text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Configure Dynamic Scope & Principal Delegations"
                            >
                              <SlidersHorizontal size={11} />
                              <span>Scope</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenRoleModal(user, 'roles')}
                              className="px-2 py-1 rounded bg-white hover:bg-[#fcf5f7] text-[#641d31] border border-[#e8e2e2] text-xs font-bold transition flex items-center gap-1 shadow-2xs"
                              title="Assign or modify roles"
                            >
                              <Shield size={11} />
                              <span>Roles</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => onInspect(user)}
                          className="p-1 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#251d21] transition"
                          title="Inspect Row JSON"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
          <span>Showing {filtered.length} staff accounts · Multi-role & Dynamic Scope enabled</span>
          <span className="font-mono text-[11px]">table: accreditation.users (26)</span>
        </div>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Role Assignments Table View (PDF Table 28)                                */
/* ========================================================================= */
function AssignmentsTableView({
  assignments,
  search,
  onInspect,
  onOpenRoleModal,
}: {
  assignments: UserRoleAssignment[]
  search: string
  onInspect: (r: any) => void
  onOpenRoleModal: (asgn: UserRoleAssignment) => void
}) {
  const filtered = assignments.filter((a) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      a.userName.toLowerCase().includes(term) ||
      a.userEmpId.toLowerCase().includes(term) ||
      a.roleName.toLowerCase().includes(term) ||
      (a.department && a.department.toLowerCase().includes(term))
    )
  })

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[1100px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[110px]">Emp ID</th>
              <th className="px-4 py-3 min-w-[180px]">User Name</th>
              <th className="px-4 py-3 min-w-[160px]">Assigned Role</th>
              <th className="px-4 py-3 min-w-[130px]">Scope Level</th>
              <th className="px-4 py-3 min-w-[180px]">Criteria Covered (Table 28)</th>
              <th className="px-4 py-3 min-w-[200px]">Delegated Powers</th>
              <th className="px-4 py-3 min-w-[160px]">Validity</th>
              <th className="px-4 py-3 min-w-[150px]">Assigned By</th>
              <th className="px-4 py-3 min-w-[130px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((asgn) => {
              return (
                <tr key={asgn.id} className="hover:bg-[#fcf7f8] transition">
                  <td className="px-4 py-3 font-mono text-[#641d31] font-bold">{asgn.userEmpId}</td>
                  <td className="px-4 py-3 font-bold text-[#251d21]">{asgn.userName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded bg-[#fcf5f7] text-[#641d31] border border-[#f3d7e0] font-bold text-[11px]">
                      {asgn.roleName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[#047857] font-semibold text-[11px]">{asgn.level}</span>
                  </td>
                  <td className="px-4 py-3 text-[#251d21] font-mono text-[11px]">
                    {asgn.criteriaCoverage || 'All 25 Criteria'}
                  </td>
                  <td className="px-4 py-3">
                    {asgn.delegatedPowers && asgn.delegatedPowers.length > 0 ? (
                      <span className="text-[10px] text-[#93641b] bg-[#fdf3e2] px-1.5 py-0.5 rounded font-bold border border-[#edd7b4]">
                        ⚡ {asgn.delegatedPowers[0].split('(')[0]}
                      </span>
                    ) : (
                      <span className="text-[#8c7d83] text-[11px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[#6c6065]">
                    {asgn.validFrom} → {asgn.validTo}
                  </td>
                  <td className="px-4 py-3 text-[#6c6065]">{asgn.assignedBy}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenRoleModal(asgn)}
                        className="px-2 py-1 rounded bg-white hover:bg-[#fcf5f7] border border-[#e8e2e2] text-[#641d31] text-xs font-bold transition shadow-2xs"
                      >
                        Edit Scope
                      </button>
                      <button
                        onClick={() => onInspect(asgn)}
                        className="p-1 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#251d21] transition"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {filtered.length} active role assignment entries</span>
        <span className="font-mono text-[11px]">table: accreditation.user_role_assignments (28)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Roles Table View (PDF Table 27)                                           */
/* ========================================================================= */
function RolesTableView({
  roles,
  onInspect,
}: {
  roles: PdfRoleDef[]
  onInspect: (r: any) => void
}) {
  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 bg-[#faf8f5] border-b border-[#e8e2e2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#251d21]">
            The 10 Official Accreditation Roles (PDF Specification Section 27)
          </h2>
          <p className="text-xs text-[#6c6065]">
            Official institutional roles, scopes, verification privileges and export permissions. Users can hold multiple roles simultaneously and receive dynamic scope delegations.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#fcf5f7] text-[#641d31] border border-[#f3d7e0] font-bold">
          10 Standard Roles
        </span>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[1050px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[50px]">#</th>
              <th className="px-4 py-3 min-w-[170px]">Role Name</th>
              <th className="px-4 py-3 min-w-[120px]">Scope Level</th>
              <th className="px-4 py-3 min-w-[100px]">Can Verify</th>
              <th className="px-4 py-3 min-w-[100px]">Can Export</th>
              <th className="px-4 py-3 min-w-[120px]">Restricted Data</th>
              <th className="px-4 py-3 min-w-[320px]">What They Do (From PDF Specification)</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {roles.map((r) => (
              <tr key={r.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065]">{r.id}</td>
                <td className="px-4 py-3 font-bold text-[#641d31]">
                  <span className="text-sm">{r.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-[#fdf3e2] text-[#93641b] border border-[#edd7b4] font-mono font-bold text-[11px]">
                    {r.level}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.can_verify ? (
                    <span className="inline-flex items-center gap-1 text-[#047857] font-bold">
                      <Check size={13} /> Yes
                    </span>
                  ) : (
                    <span className="text-[#8c7d83]">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.can_export ? (
                    <span className="inline-flex items-center gap-1 text-[#1d4ed8] font-bold">
                      <Check size={13} /> Yes
                    </span>
                  ) : (
                    <span className="text-[#8c7d83]">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.can_see_restricted ? (
                    <span className="text-[#b45309] font-bold">Yes</span>
                  ) : (
                    <span className="text-[#8c7d83]">No</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#251d21] leading-relaxed font-medium">
                  {r.whatTheyDo}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(r)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Users can have multiple roles assigned in PostgreSQL (user_role_assignments)</span>
        <span className="font-mono text-[11px]">table: accreditation.roles (27)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Role Permissions Table View (PDF Table 29)                                */
/* ========================================================================= */
export interface RolePermissionMatrixRow {
  id: number
  role: string
  dataType: string
  canView: boolean
  canAdd: boolean
  canEditOwn: boolean
  canEditAny: boolean
  canDelete: boolean
  canSubmit: boolean
  canVerify: boolean
  canExport: boolean
  canSeeRestricted: boolean
}

export const ROLE_PERMISSIONS_MATRIX: RolePermissionMatrixRow[] = [
  {
    id: 1,
    role: 'Super Admin',
    dataType: 'Master Lists & User Accounts (1-34)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: true,
    canSubmit: false,
    canVerify: false,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 2,
    role: 'Principal / Director',
    dataType: 'All 25 Criteria Modules (Institute)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: true,
    canSubmit: true,
    canVerify: true,
    canExport: true,
    canSeeRestricted: true,
  },
  {
    id: 3,
    role: 'IQAC Coordinator',
    dataType: 'All 25 Criteria Modules (Institute)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: false,
    canSubmit: true,
    canVerify: true,
    canExport: true,
    canSeeRestricted: true,
  },
  {
    id: 4,
    role: 'IQAC Member',
    dataType: 'Assigned Criteria Modules (Institute)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: false,
    canDelete: false,
    canSubmit: true,
    canVerify: true,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 5,
    role: 'Dean',
    dataType: 'School Constituents (All 25 Criteria)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: false,
    canSubmit: true,
    canVerify: true,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 6,
    role: 'HOD',
    dataType: 'Department Records (All 25 Criteria)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: false,
    canSubmit: true,
    canVerify: true,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 7,
    role: 'Department Coordinator',
    dataType: 'Department Entries (All 25 Criteria)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: true,
    canDelete: true,
    canSubmit: true,
    canVerify: false,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 8,
    role: 'Faculty',
    dataType: 'Own Profile, Research, Events (8-16, 25)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: false,
    canDelete: true,
    canSubmit: true,
    canVerify: false,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 9,
    role: 'Non-teaching Staff',
    dataType: 'Section Operational Data (6, 7, 19, 22, 23)',
    canView: true,
    canAdd: true,
    canEditOwn: true,
    canEditAny: false,
    canDelete: true,
    canSubmit: true,
    canVerify: false,
    canExport: false,
    canSeeRestricted: false,
  },
  {
    id: 10,
    role: 'Reviewer',
    dataType: 'Verified Criteria Records (Audit Only)',
    canView: true,
    canAdd: false,
    canEditOwn: false,
    canEditAny: false,
    canDelete: false,
    canSubmit: false,
    canVerify: false,
    canExport: true,
    canSeeRestricted: false,
  },
]

function RolePermissionsTableView({
  search,
  onInspect,
}: {
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = ROLE_PERMISSIONS_MATRIX.filter(
    (p) =>
      !search ||
      p.role.toLowerCase().includes(search.toLowerCase()) ||
      p.dataType.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="p-4 bg-[#faf8f5] border-b border-[#e8e2e2] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#251d21]">
            Role Permissions Matrix (PDF Specification Section 29)
          </h2>
          <p className="text-xs text-[#6c6065]">
            Granular access matrix defining View, Add, Edit Own, Edit Any, Delete, Submit, Verify, Export, and Restricted Data rights per Role.
          </p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] font-bold">
          Table 29: role_permissions
        </span>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[1100px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[160px]">Role</th>
              <th className="px-4 py-3 min-w-[200px]">Data Type Coverage</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can View</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can Add</th>
              <th className="px-3 py-3 text-center min-w-[90px]">Can Edit Own</th>
              <th className="px-3 py-3 text-center min-w-[90px]">Can Edit Any</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can Delete</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can Submit</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can Verify</th>
              <th className="px-3 py-3 text-center min-w-[80px]">Can Export</th>
              <th className="px-3 py-3 text-center min-w-[100px]">Restricted Data</th>
              <th className="px-4 py-3 min-w-[70px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-bold text-[#641d31]">{item.role}</td>
                <td className="px-4 py-3 text-[#251d21] font-medium text-[11px]">
                  {item.dataType}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canView ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canAdd ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canEditOwn ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canEditAny ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canDelete ? (
                    <span className="text-[#b91c1c] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canSubmit ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canVerify ? (
                    <span className="text-[#047857] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canExport ? (
                    <span className="text-[#1d4ed8] font-bold">✓</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-center">
                  {item.canSeeRestricted ? (
                    <span className="text-[#b45309] font-bold">✓ Yes</span>
                  ) : (
                    <span className="text-[#8c7d83]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(item)}
                    className="p-1 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Dynamic Scope overrides can selectively extend these permissions per user</span>
        <span className="font-mono text-[11px]">table: accreditation.role_permissions (29)</span>
      </div>
    </div>
  )
}


/* ========================================================================= */
/* Schools Table View (PDF Table 30)                                         */
/* ========================================================================= */
function SchoolsTableView({
  schools,
  search,
  onInspect,
}: {
  schools: any[]
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = schools.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[850px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[60px]">ID</th>
              <th className="px-4 py-3 min-w-[90px]">Code</th>
              <th className="px-4 py-3 min-w-[220px]">School Name</th>
              <th className="px-4 py-3 min-w-[180px]">Dean / In-Charge</th>
              <th className="px-4 py-3 min-w-[100px]">Est. Year</th>
              <th className="px-4 py-3 min-w-[90px]">Status</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((school) => (
              <tr key={school.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065]">{school.id}</td>
                <td className="px-4 py-3 font-mono text-[#641d31] font-bold">{school.code}</td>
                <td className="px-4 py-3 font-bold text-[#251d21]">{school.name}</td>
                <td className="px-4 py-3 text-[#6c6065]">
                  {school.dean || 'Assigned via Dean role'}
                </td>
                <td className="px-4 py-3 text-[#6c6065] font-mono">{school.established || 2002}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-[#047857] font-bold bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded">
                    Active
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(school)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                    title="View JSON Row"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {filtered.length} constituent schools</span>
        <span className="font-mono text-[11px]">table: accreditation.schools (30)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Departments Table View (PDF Table 31)                                     */
/* ========================================================================= */
function DepartmentsTableView({
  departments,
  search,
  onInspect,
}: {
  departments: any[]
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = departments.filter(
    (d) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[850px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[60px]">ID</th>
              <th className="px-4 py-3 min-w-[80px]">School ID</th>
              <th className="px-4 py-3 min-w-[90px]">Code</th>
              <th className="px-4 py-3 min-w-[220px]">Department Name</th>
              <th className="px-4 py-3 min-w-[180px]">Head of Dept</th>
              <th className="px-4 py-3 min-w-[90px]">Status</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((dept) => (
              <tr key={dept.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065]">{dept.id}</td>
                <td className="px-4 py-3 font-mono text-[#251d21]">{dept.school_id || 1}</td>
                <td className="px-4 py-3 font-mono text-[#641d31] font-bold">{dept.code || 'ENG'}</td>
                <td className="px-4 py-3 font-bold text-[#251d21]">{dept.name}</td>
                <td className="px-4 py-3 text-[#6c6065]">{dept.head || 'Assigned via HOD role'}</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-[#047857] font-bold bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded">
                    Active
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(dept)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {filtered.length} academic departments</span>
        <span className="font-mono text-[11px]">table: accreditation.departments (31)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Programmes Table View (PDF Table 32)                                      */
/* ========================================================================= */
function ProgrammesTableView({
  programmes,
  search,
  onInspect,
}: {
  programmes: any[]
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = programmes.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[850px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[60px]">ID</th>
              <th className="px-4 py-3 min-w-[80px]">Dept ID</th>
              <th className="px-4 py-3 min-w-[100px]">Code</th>
              <th className="px-4 py-3 min-w-[220px]">Programme Name</th>
              <th className="px-4 py-3 min-w-[80px]">Level</th>
              <th className="px-4 py-3 min-w-[90px]">Duration</th>
              <th className="px-4 py-3 min-w-[90px]">Status</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((prog) => (
              <tr key={prog.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065]">{prog.id}</td>
                <td className="px-4 py-3 font-mono text-[#251d21]">{prog.department_id || 1}</td>
                <td className="px-4 py-3 font-mono text-[#641d31] font-bold">{prog.code || 'BTECH-CE'}</td>
                <td className="px-4 py-3 font-bold text-[#251d21]">{prog.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] font-mono font-bold text-[11px]">
                    {prog.level || 'UG'}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#6c6065] font-mono">{prog.duration_years || 4.0} Yrs</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] text-[#047857] font-bold bg-[#ecfdf5] border border-[#a7f3d0] px-2 py-0.5 rounded">
                    {prog.status || 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(prog)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {filtered.length} academic degree programmes</span>
        <span className="font-mono text-[11px]">table: accreditation.programmes (32)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Academic Years Table View (PDF Table 33)                                  */
/* ========================================================================= */
function YearsTableView({
  years,
  search,
  onInspect,
}: {
  years: any[]
  search: string
  onInspect: (r: any) => void
}) {
  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[850px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[60px]">ID</th>
              <th className="px-4 py-3 min-w-[140px]">Year Label</th>
              <th className="px-4 py-3 min-w-[120px]">Start Date</th>
              <th className="px-4 py-3 min-w-[120px]">End Date</th>
              <th className="px-4 py-3 min-w-[130px]">Financial Year</th>
              <th className="px-4 py-3 min-w-[100px]">Current Flag</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {years.map((y) => (
              <tr key={y.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065]">{y.id}</td>
                <td className="px-4 py-3 font-bold text-[#251d21]">{y.label}</td>
                <td className="px-4 py-3 font-mono text-[#6c6065]">2025-06-01</td>
                <td className="px-4 py-3 font-mono text-[#6c6065]">2026-05-31</td>
                <td className="px-4 py-3 font-mono text-[#251d21]">FY 2025-26</td>
                <td className="px-4 py-3">
                  {y.is_current ? (
                    <span className="px-2 py-0.5 rounded bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0] text-[10px] font-bold uppercase">
                      Current
                    </span>
                  ) : (
                    <span className="text-[#8c7d83] text-[11px]">Archived</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(y)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {years.length} accreditation academic cycles</span>
        <span className="font-mono text-[11px]">table: accreditation.academic_years (33)</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Records Table View (PDF 1 to 25)                                          */
/* ========================================================================= */
function RecordsTableView({
  records,
  search,
  onInspect,
}: {
  records: any[]
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = records.filter(
    (r) =>
      !search ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      (r.type_name && r.type_name.toLowerCase().includes(search.toLowerCase())) ||
      (r.status && r.status.toLowerCase().includes(search.toLowerCase())) ||
      (r.remarks && r.remarks.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[950px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[100px]">UUID</th>
              <th className="px-4 py-3 min-w-[170px]">Type</th>
              <th className="px-4 py-3 min-w-[120px]">Academic Year</th>
              <th className="px-4 py-3 min-w-[160px]">Department</th>
              <th className="px-4 py-3 min-w-[100px]">Status</th>
              <th className="px-4 py-3 min-w-[260px]">Remarks / Summary</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.slice(0, 50).map((rec) => (
              <tr key={rec.id} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#641d31] font-semibold text-[11px]">
                  {rec.id.substring(0, 8)}...
                </td>
                <td className="px-4 py-3 font-bold text-[#251d21]">
                  {rec.type_name || `Module #${rec.type_id}`}
                </td>
                <td className="px-4 py-3 text-[#6c6065]">{rec.academic_year || 'AY 2025-26'}</td>
                <td className="px-4 py-3 text-[#6c6065]">{rec.department || 'Computer Engineering'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      rec.status === 'Verified'
                        ? 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                        : rec.status === 'Submitted'
                        ? 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                        : 'bg-[#f3f4f6] text-[#374151]'
                    }`}
                  >
                    {rec.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#6c6065] max-w-sm truncate">
                  {rec.remarks || 'Accreditation evidence item'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(rec)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {Math.min(50, filtered.length)} of {records.length} records</span>
        <span className="font-mono text-[11px]">table: accreditation.records</span>
      </div>
    </div>
  )
}

/* ========================================================================= */
/* Audit Log Table View (PDF Table 34)                                       */
/* ========================================================================= */
function AuditLogTableView({
  logs,
  search,
  onInspect,
}: {
  logs: any[]
  search: string
  onInspect: (r: any) => void
}) {
  const filtered = logs.filter(
    (l) =>
      !search ||
      (l.action && l.action.toLowerCase().includes(search.toLowerCase())) ||
      (l.user && l.user.toLowerCase().includes(search.toLowerCase())) ||
      (l.ref && l.ref.toLowerCase().includes(search.toLowerCase())) ||
      (l.dataType && l.dataType.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white border border-[#e8e2e2] rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs min-w-[950px] border-collapse">
          <thead className="bg-[#faf6f7] border-b border-[#e8e2e2] text-[#641d31] font-bold text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 min-w-[130px]">Timestamp</th>
              <th className="px-4 py-3 min-w-[110px]">Action</th>
              <th className="px-4 py-3 min-w-[160px]">User</th>
              <th className="px-4 py-3 min-w-[150px]">Data Type / Table</th>
              <th className="px-4 py-3 min-w-[120px]">Record Ref</th>
              <th className="px-4 py-3 min-w-[140px]">Department</th>
              <th className="px-4 py-3 min-w-[80px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ece9]">
            {filtered.map((log, idx) => (
              <tr key={log.id || idx} className="hover:bg-[#fcf7f8] transition">
                <td className="px-4 py-3 font-mono text-[#6c6065] whitespace-nowrap">
                  {log.dateTime || log.timestamp}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      log.action === 'Verified'
                        ? 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                        : log.action === 'Role Changed'
                        ? 'bg-[#fcf5f7] text-[#641d31] border border-[#f3d7e0]'
                        : log.action === 'Submitted'
                        ? 'bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe]'
                        : log.action === 'Edited'
                        ? 'bg-[#fffbeb] text-[#b45309] border border-[#fde68a]'
                        : 'bg-[#f3f4f6] text-[#374151]'
                    }`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold text-[#251d21]">{log.user}</td>
                <td className="px-4 py-3 text-[#251d21]">{log.dataType}</td>
                <td className="px-4 py-3 font-mono text-[#641d31] font-semibold text-[11px]">{log.ref}</td>
                <td className="px-4 py-3 text-[#6c6065]">{log.dept || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onInspect(log)}
                    className="p-1.5 rounded hover:bg-[#faf8f5] text-[#6c6065] hover:text-[#641d31] transition"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-[#e8e2e2] bg-[#faf8f5] text-xs text-[#6c6065] flex justify-between">
        <span>Showing {filtered.length} audit trail records</span>
        <span className="font-mono text-[11px]">table: accreditation.audit_log (34)</span>
      </div>
    </div>
  )
}

export default CmsPanel

