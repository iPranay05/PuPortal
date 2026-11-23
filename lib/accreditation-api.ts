import {
  DEMO_STAFF,
  DEMO_DIRECTORY,
  DEMO_RECORDS,
  DEMO_REPORTS_SUMMARY,
} from './mock-demo-data'

export type StaffProfile = {
  id: number
  name: string
  email: string
  school_id: number | null
  department_id: number | null
  roles: string[]
  password_reset_required: boolean
  add_types: number[]
}

export type Directory = {
  schools: { id: number; name: string }[]
  departments: { id: number; school_id: number; name: string }[]
  programmes: { id: number; department_id: number; name: string }[]
  years: { id: number; label: string; is_current: boolean }[]
}

export type RecordRow = {
  id: string
  type_id: number
  type_name: string
  academic_year_id: number
  school_id: number
  department_id: number
  programme_id: number | null
  proof: string | null
  remarks: string | null
  status: 'Draft' | 'Submitted' | 'Verified' | 'Rejected'
  actions: string[]
  academic_year?: string
  school?: string
  department?: string
  programme?: string
}

export type RecordDetail = RecordRow & {
  details: Record<string, unknown>
  evidence: { filename: string } | null
  links: { id: string; type_id: number; relationship: string }[]
  can_see_restricted: boolean
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// In-memory demo records store for interactive edits/additions during demo session
let liveDemoRecords = [...DEMO_RECORDS]
// Real user records store (starts completely clean — no mock data for real users)
let liveRealRecords: RecordDetail[] = []

export async function apiResponse(path: string, token = '', options: RequestInit = {}) {
  // If demo account token is active, intercept with rich mock demo data
  // If real user token is active, isolate to real user records (clean/empty by default)
  if (token.startsWith('demo-') || token.startsWith('real-')) {
    const isRealUser = token.startsWith('real-')
    const activeRecords = isRealUser ? liveRealRecords : liveDemoRecords
    const parsedUrl = new URL(path, 'http://localhost:3000')
    const pathname = parsedUrl.pathname
    const searchParams = parsedUrl.searchParams

    if (pathname === '/api/status') {
      return new Response(JSON.stringify({ status: 'ready' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/api/auth/me') {
      if (isRealUser) {
        // Return stored real user profile
        try {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('pu_current_real_user') : null
          if (saved) {
            return new Response(saved, {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        } catch {}
      }
      return new Response(JSON.stringify(DEMO_STAFF), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/api/directory') {
      return new Response(JSON.stringify(DEMO_DIRECTORY), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/api/records') {
      if (options.method === 'POST') {
        const body = options.body ? JSON.parse(options.body as string) : {}
        const newRecord: RecordDetail = {
          id: (isRealUser ? 'rec-' : 'demo-') + Math.random().toString(36).substring(2, 10),
          type_id: body.type_id || 1,
          type_name: 'Accreditation Record',
          academic_year_id: body.academic_year_id || 1,
          academic_year: 'AY 2025-26',
          school_id: body.school_id || 1,
          school: 'School of Engineering',
          department_id: body.department_id || 1,
          department: 'Computer Engineering',
          programme_id: body.programme_id || 1,
          programme: 'B.Tech Computer Engineering',
          status: 'Draft',
          actions: ['view', 'edit', 'submit'],
          proof: body.proof || null,
          remarks: body.remarks || 'New draft evidence entry',
          can_see_restricted: true,
          evidence: null,
          links: [],
          details: body.details || {},
        }
        if (isRealUser) {
          liveRealRecords = [newRecord, ...liveRealRecords]
        } else {
          liveDemoRecords = [newRecord, ...liveDemoRecords]
        }
        return new Response(JSON.stringify({ id: newRecord.id }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Filter rows
      const typeId = searchParams.get('type_id')
      const yearId = searchParams.get('academic_year_id')
      const statusFilter = searchParams.get('status')

      let filtered = isRealUser ? [...liveRealRecords] : [...liveDemoRecords]
      if (typeId) filtered = filtered.filter((r) => r.type_id === Number(typeId))
      if (yearId) filtered = filtered.filter((r) => r.academic_year_id === Number(yearId))
      if (statusFilter) filtered = filtered.filter((r) => r.status === statusFilter)

      return new Response(
        JSON.stringify({
          items: filtered,
          has_more: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (pathname.startsWith('/api/records/')) {
      const recordId = pathname.replace('/api/records/', '').split('/')[0]
      const recordsPool = isRealUser ? liveRealRecords : liveDemoRecords
      const found = recordsPool.find((r) => r.id === recordId) || recordsPool[0]

      if (found) {
        if (pathname.endsWith('/submit')) {
          found.status = 'Submitted'
          return new Response(null, { status: 204 })
        }
        if (pathname.endsWith('/verify')) {
          found.status = 'Verified'
          return new Response(null, { status: 204 })
        }
        if (pathname.endsWith('/reject')) {
          found.status = 'Draft'
          return new Response(null, { status: 204 })
        }
      }

      if (options.method === 'DELETE') {
        if (isRealUser) {
          liveRealRecords = liveRealRecords.filter((r) => r.id !== recordId)
        } else {
          liveDemoRecords = liveDemoRecords.filter((r) => r.id !== recordId)
        }
        return new Response(null, { status: 204 })
      }

      return new Response(JSON.stringify(found || {}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (pathname === '/api/reports/summary') {
      const yearId = searchParams.get('academic_year_id')
      return new Response(
        JSON.stringify(
          isRealUser
            ? {
                academic_year_id: 1,
                records_by_type: {},
                records_by_status: { Draft: liveRealRecords.filter(r => r.status==='Draft').length, Submitted: liveRealRecords.filter(r => r.status==='Submitted').length, Verified: liveRealRecords.filter(r => r.status==='Verified').length },
                recent_activity: [],
              }
            : DEMO_REPORTS_SUMMARY
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    if (pathname === '/api/reports/export') {
      const typeId = searchParams.get('type_id') || '1'
      const matched = (isRealUser ? liveRealRecords : liveDemoRecords).filter((r) => r.type_id === Number(typeId))
      const csv =
        'id,type,academic_year,department,status,remarks\n' +
        matched.map((m) => `${m.id},"${m.type_name}","${m.academic_year}","${m.department}","${m.status}","${m.remarks}"`).join('\n')

      return new Response('\uFEFF' + csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${isRealUser ? 'real' : 'demo'}_export_${typeId}.csv"`,
        },
      })
    }

    if (pathname === '/api/auth/logout') {
      return new Response(null, { status: 204 })
    }
  }

  // Real backend call
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body) headers.set('Content-Type', 'application/json')

  try {
    const result = await fetch(path, { ...options, headers, cache: 'no-store' })
    if (!result.ok) {
      const data = await result.json().catch(() => null)
      const detail =
        typeof data?.detail === 'string'
          ? data.detail
          : Array.isArray(data?.detail)
          ? data.detail.map((item: { msg: string }) => item.msg).join(' ')
          : 'The FastAPI service could not complete this request.'
      throw new ApiError(detail, result.status)
    }
    return result
  } catch (error) {
    // If status check fails because backend is offline, return mock ready so user can preview demo
    if (path === '/api/status') {
      return new Response(JSON.stringify({ status: 'ready' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    throw error
  }
}

export async function api<T>(path: string, token = '', options?: RequestInit): Promise<T> {
  const result = await apiResponse(path, token, options)
  return result.status === 204 ? (undefined as T) : result.json()
}

export function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please retry.'
}
