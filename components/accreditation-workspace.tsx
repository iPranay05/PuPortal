'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Database,
  FileText,
  Layers3,
  LayoutGrid,
  Search,
  ShieldCheck,
  X,
  LogIn,
} from 'lucide-react'
import { modules, shared, systemTables } from '@/lib/modules'
import {
  FieldDictionary,
  SystemDictionary,
  type RecordType,
} from './accreditation-dictionary'
import { AccreditationRecords } from './accreditation-records'
import {
  LeftNavbar,
  NAV_CATEGORIES,
  type NavItemId,
} from './left-navbar'
import { TopHeader } from './top-header'
import { ReportsView } from './reports-view'
import { BulkImportView } from './bulk-import-view'
import { ModuleView } from './module-view'
import { LoginView } from './login-view'
import { DashboardOverview } from './dashboard-overview'
import { MasterDataRbacView } from './master-data-rbac-view'
import { AuditLogView } from './audit-log-view'
import { api, type StaffProfile } from '@/lib/accreditation-api'

const getCatalog = async (url: string): Promise<RecordType[]> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Catalog unavailable')
  return response.json()
}

export type ExtendedNavItemId = NavItemId | 'login'

export default function Workspace({
  initialCatalog,
}: {
  initialCatalog: RecordType[]
}) {
  const { data: catalog = initialCatalog } = useSWR(
    '/api/catalog',
    getCatalog,
    { fallbackData: initialCatalog, shouldRetryOnError: false, revalidateOnFocus: false }
  )

  // Auth State — start unauthenticated; token loaded from localStorage on mount
  const [token, setToken] = useState<string>('')
  const [staff, setStaff] = useState<StaffProfile | null>(null)
  const [logoutNotice, setLogoutNotice] = useState<string>('')

  // Load token from localStorage on client mount, then fetch real profile
  useEffect(() => {
    const savedToken = localStorage.getItem('accredify_token')
    if (savedToken) {
      setToken(savedToken)
      // Restore staff profile from real backend
      api<StaffProfile>('/api/auth/me', savedToken)
        .then((profile) => setStaff(profile))
        .catch(() => {
          // Token expired or invalid — force re-login
          localStorage.removeItem('accredify_token')
          setToken('')
          setActiveNav('login')
        })
    } else {
      setActiveNav('login')
    }
  }, [])

  // Navigation State — start on login; useEffect above will update if token exists
  const [activeNav, setActiveNav] = useState<ExtendedNavItemId>('login')
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)
  const [academicYear, setAcademicYear] = useState('AY 2025-26 (Current)')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sub-views and dialogs
  const [recordDialog, setRecordDialog] = useState<RecordType | null>(null)
  const [systemDialog, setSystemDialog] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (recordDialog || systemDialog !== null) {
      if (!dialog.current?.open) dialog.current?.showModal()
    } else {
      dialog.current?.close()
    }
  }, [recordDialog, systemDialog])

  function resetDialog() {
    setRecordDialog(null)
    setSystemDialog(null)
  }

  // Handle selection from left navbar
  const handleNavSelect = (id: NavItemId, moduleId?: number) => {
    setActiveNav(id)
    if (moduleId !== undefined) {
      setSelectedModuleId(moduleId)
    } else if (id === 'dashboard') {
      setSelectedModuleId(null)
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  // Handle Sign In Success
  const handleLoginSuccess = (newToken: string, profileData?: StaffProfile) => {
    setToken(newToken)
    localStorage.setItem('accredify_token', newToken)
    if (profileData) {
      setStaff(profileData)
    }
    setLogoutNotice('')
    setActiveNav('dashboard')
  }

  // Handle Working Sign Out
  const handleSignOut = async () => {
    if (token && !token.startsWith('demo-')) {
      try {
        await api('/api/auth/logout', token, { method: 'POST' })
      } catch {
        // Continue clearing client state even if network call errors
      }
    }
    setToken('')
    localStorage.removeItem('accredify_token')
    setStaff(null)
    setLogoutNotice('You have been signed out safely.')
    setActiveNav('login')
  }

  // Calculate breadcrumbs based on activeNav
  const breadcrumb = useMemo(() => {
    if (activeNav === 'dashboard') return ['Institution', 'Dashboard']
    if (activeNav === 'reports') return ['Institution', 'Reports & Exports']
    if (activeNav === 'import') return ['Institution', 'Bulk Import']
    if (activeNav === 'rbac') return ['Institution', 'System & Master Data']
    if (activeNav === 'audit') return ['Institution', 'Audit Log']

    if (activeNav.startsWith('module-')) {
      const modId = selectedModuleId || parseInt(activeNav.replace('module-', ''), 10)
      for (const cat of NAV_CATEGORIES) {
        const found = cat.modules.find((m) => m.id === modId)
        if (found) {
          return [cat.label, found.name]
        }
      }
      return ['Module', `Record Type ${modId}`]
    }

    return ['Institution', 'Accreditation']
  }, [activeNav, selectedModuleId])

  // Get current active module record if a module is selected
  const activeModuleRecord = useMemo(() => {
    if (!selectedModuleId) return null
    return catalog.find((r) => r.id === selectedModuleId) || null
  }, [catalog, selectedModuleId])

  // Get category label of the selected module
  const activeModuleCategory = useMemo(() => {
    if (!selectedModuleId) return ''
    for (const cat of NAV_CATEGORIES) {
      if (cat.modules.some((m) => m.id === selectedModuleId)) {
        return cat.label
      }
    }
    return 'Accreditation'
  }, [selectedModuleId])

  const userDisplayName = staff?.name || 'Guest User'
  const userRoleLabel = staff?.roles?.join(' · ') || 'Guest Access'

  return (
    <div className="portal" data-ready={ready}>
      <a className="skip-link" href="#workspace-main">
        Skip to content
      </a>

      {/* Signature Pillai University Red Masthead */}
      <header className="masthead">
        <div className="masthead-inner px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="brand"
              onClick={() => handleNavSelect('dashboard')}
              aria-label="Pillai University accreditation home"
            >
              <Image src="/crest.webp" alt="" width={36} height={40} priority />
              <span>
                <strong>Pillai University</strong>
                <small>FROM KNOWLEDGE TO CREATION</small>
              </span>
            </button>
            <div className="brand-divider" />
            <span className="brand-portal">Accredify Record System</span>
          </div>
          <div className="flex items-center gap-4">
            {token ? (
              <span className="text-xs text-[#ebc992] font-semibold hidden md:inline">
                {userRoleLabel}
              </span>
            ) : activeNav !== 'login' ? (
              <button
                type="button"
                onClick={() => setActiveNav('login')}
                className="text-xs text-[#ebc992] hover:text-white font-semibold flex items-center gap-1"
              >
                <LogIn size={13} />
                <span>Sign In</span>
              </button>
            ) : null}
            <Link
              className="university-link bg-[#38111e] hover:bg-[#501729] border border-[#a23253]/40 text-[#ebc992] hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
              href="/cms"
            >
              <Database size={13} />
              <span>CMS Studio</span>
            </Link>
            <a
              className="university-link"
              href="https://pillai.edu.in"
              target="_blank"
              rel="noreferrer"
            >
              University Website <ArrowUpRight size={15} />
            </a>
          </div>
        </div>
      </header>

      {/* When on Login page: Standalone Centered Layout (No Left Navbar, No Top Header) */}
      {activeNav === 'login' ? (
        <main id="workspace-main" className="login-standalone-container">
          <LoginView
            onSuccess={handleLoginSuccess}
            onCancel={staff ? () => handleNavSelect('dashboard') : undefined}
            initialMessage={logoutNotice}
          />
        </main>
      ) : (
        /* Main Layout: Left Navbar + Content */
        <div className="portal-layout-container">
          {/* Left Navbar in Wine/Red Theme */}
          <LeftNavbar
            activeId={activeNav as NavItemId}
            onSelect={handleNavSelect}
            userTitle="Accredify Modules"
            userName={userDisplayName}
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
          />

          {/* Content Area */}
          <div className="portal-main-area">
            {/* Top Sub-Header with Breadcrumb, AY selector, & Active SignOut/SignIn */}
            <TopHeader
              breadcrumb={breadcrumb}
              academicYear={academicYear}
              onAcademicYearChange={setAcademicYear}
              userRole={userRoleLabel}
              userName={userDisplayName}
              isAuthenticated={Boolean(token)}
              onToggleMobileNav={() => setMobileNavOpen(true)}
              onSignOut={handleSignOut}
              onSignIn={() => setActiveNav('login')}
            />

            {/* View Container */}
            <main id="workspace-main" className="portal-content-view">
              {/* View: Reports & Exports */}
              {activeNav === 'reports' && (
                <ReportsView
                  currentAcademicYear={academicYear.replace(' (Current)', '')}
                  onOpenModule={(modId) => handleNavSelect(`module-${modId}`, modId)}
                  isRealUser={Boolean(token && !token.startsWith('demo-'))}
                />
              )}

              {/* View: Bulk Import */}
              {activeNav === 'import' && (
                <BulkImportView
                  catalog={catalog}
                  initialModuleId={selectedModuleId || 1}
                  onNavigateToModule={(modId) => handleNavSelect(`module-${modId}`, modId)}
                />
              )}

              {/* View: Master Data & RBAC matching Screenshot 1 */}
              {activeNav === 'rbac' && (
                <MasterDataRbacView isRealUser={Boolean(token && !token.startsWith('demo-'))} />
              )}

              {/* View: Specific Module View */}
              {activeNav.startsWith('module-') && activeModuleRecord && (
                <ModuleView
                  record={activeModuleRecord}
                  categoryName={activeModuleCategory}
                  academicYear={academicYear}
                  onExportCsv={() => {}}
                  isRealUser={Boolean(token && !token.startsWith('demo-'))}
                  userStaff={staff}
                />
              )}

              {/* View: Dashboard / Overview matching Screenshot 1 */}
              {activeNav === 'dashboard' && (
                <DashboardOverview
                  onOpenModule={(modId) => handleNavSelect(`module-${modId}`, modId)}
                  currentAcademicYear={academicYear}
                  isRealUser={Boolean(token && !token.startsWith('demo-'))}
                  userStaff={staff}
                />
              )}

              {/* View: Audit Log matching Screenshot 2 */}
              {activeNav === 'audit' && (
                <AuditLogView
                  isRealUser={Boolean(token && !token.startsWith('demo-'))}
                  userStaff={staff}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="shell footer-inner">
          <span>
            <BookOpen size={17} /> Pillai University{' '}
            <span className="footer-dot" /> Accreditation Workspace
          </span>
          <a href="/accreditation.sql" download="pillai-accreditation.sql">
            PostgreSQL schema <ArrowDownToLine size={15} />
          </a>
        </div>
      </footer>

      {/* Field / System Dictionary Dialog */}
      <dialog
        ref={dialog}
        className="dictionary-dialog"
        onClose={resetDialog}
        aria-labelledby="dictionary-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close()
        }}
      >
        <div className="dialog-content">
          <button
            className="dialog-close"
            aria-label="Close dialog"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
          {recordDialog ? (
            <FieldDictionary record={recordDialog} />
          ) : systemDialog !== null ? (
            <SystemDictionary index={systemDialog} />
          ) : null}
        </div>
      </dialog>
    </div>
  )
}

function Metric({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: React.ReactNode
  value: number
  label: string
  detail: string
  tone: string
}) {
  return (
    <div className="metric">
      <div className={`stat-icon ${tone}`} aria-hidden="true">
        {icon}
      </div>
      <div>
        <div className="metric-title">
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
        <p>{detail}</p>
      </div>
    </div>
  )
}
