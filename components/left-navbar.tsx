'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart2,
  UploadCloud,
  ShieldCheck,
  GraduationCap,
  UserCheck,
  BookOpen,
  Landmark,
  Search,
  X,
  Database,
} from 'lucide-react'

export interface NavModuleItem {
  id: number
  badge: string
  name: string
  category: 'students' | 'faculty' | 'research' | 'institution'
}

export interface NavCategory {
  id: 'students' | 'faculty' | 'research' | 'institution'
  label: string
  icon: typeof GraduationCap
  modules: NavModuleItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'students',
    label: 'Students',
    icon: GraduationCap,
    modules: [
      { id: 1, badge: '01', name: 'Higher Studies', category: 'students' },
      { id: 2, badge: '02', name: 'Placements', category: 'students' },
      { id: 3, badge: '03', name: 'Internships', category: 'students' },
      { id: 4, badge: '04', name: 'Value-Added Courses', category: 'students' },
      { id: 5, badge: '05', name: 'Industry Certificates', category: 'students' },
      { id: 6, badge: '06', name: 'Scholarships', category: 'students' },
      { id: 7, badge: '07', name: 'Clubs', category: 'students' },
    ],
  },
  {
    id: 'faculty',
    label: 'Faculty',
    icon: UserCheck,
    modules: [
      { id: 8, badge: '08', name: 'Faculty Profile', category: 'faculty' },
      { id: 9, badge: '09', name: 'Faculty Programs', category: 'faculty' },
      { id: 10, badge: '10', name: 'Faculty Interaction', category: 'faculty' },
      { id: 25, badge: '25', name: 'Citations & h-index', category: 'faculty' },
    ],
  },
  {
    id: 'research',
    label: 'Research & Innovation',
    icon: BookOpen,
    modules: [
      { id: 11, badge: '11', name: 'Publications', category: 'research' },
      { id: 12, badge: '12', name: 'Grants', category: 'research' },
      { id: 13, badge: '13', name: 'Consultancy', category: 'research' },
      { id: 14, badge: '14', name: 'Patents', category: 'research' },
      { id: 15, badge: '15', name: 'Copyright', category: 'research' },
      { id: 16, badge: '16', name: 'Startups', category: 'research' },
    ],
  },
  {
    id: 'institution',
    label: 'Institution',
    icon: Landmark,
    modules: [
      { id: 17, badge: '17', name: 'Events', category: 'institution' },
      { id: 18, badge: '18', name: 'MoUs', category: 'institution' },
      { id: 19, badge: '19', name: 'Infrastructure', category: 'institution' },
      { id: 20, badge: '20', name: 'Best Practices', category: 'institution' },
      { id: 21, badge: '21', name: 'Achievements', category: 'institution' },
      { id: 22, badge: '22', name: 'Committees', category: 'institution' },
      { id: 23, badge: '23', name: 'Policies', category: 'institution' },
      { id: 24, badge: '24', name: 'Programs & Intake', category: 'institution' },
    ],
  },
]

export const TOP_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'reports', label: 'Reports & Exports', icon: BarChart2 },
  { id: 'import', label: 'Bulk Import', icon: UploadCloud },
  { id: 'rbac', label: 'Master Data & RBAC', icon: ShieldCheck },
  { id: 'audit', label: 'Audit Log', icon: BookOpen },
] as const

export type NavItemId =
  | 'dashboard'
  | 'reports'
  | 'import'
  | 'rbac'
  | 'audit'
  | `module-${number}`

interface LeftNavbarProps {
  activeId: NavItemId
  onSelect: (id: NavItemId, moduleId?: number) => void
  userTitle?: string
  userName?: string
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

export function LeftNavbar({
  activeId,
  onSelect,
  userTitle = 'Accredify Record System',
  userName = 'Dr. Arvind Gokhale',
  mobileOpen = false,
  onCloseMobile,
}: LeftNavbarProps) {
  const [filterQuery, setFilterQuery] = useState('')

  const trimmedQuery = filterQuery.trim().toLowerCase()

  const filteredCategories = useMemo(() => {
    if (!trimmedQuery) return NAV_CATEGORIES

    return NAV_CATEGORIES.map((category) => {
      const matchingModules = category.modules.filter(
        (m) =>
          m.name.toLowerCase().includes(trimmedQuery) ||
          m.badge.includes(trimmedQuery) ||
          category.label.toLowerCase().includes(trimmedQuery)
      )
      return {
        ...category,
        modules: matchingModules,
      }
    }).filter((category) => category.modules.length > 0)
  }, [trimmedQuery])

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`left-navbar ${
          mobileOpen ? 'left-navbar-mobile-open' : ''
        }`}
        aria-label="Main Navigation"
      >
        {/* Header with Pillai Branding */}
        <div className="left-navbar-header">
          <div className="left-navbar-brand-row">
            <Image
              src="/crest.webp"
              alt="Pillai Crest"
              width={28}
              height={32}
              priority
              className="left-navbar-brand-logo"
            />
            <div className="left-navbar-brand">
              <h1 className="left-navbar-title">{userTitle}</h1>
              <p className="left-navbar-subtitle">{userName}</p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              className="left-navbar-close-btn lg:hidden"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Search / Filter box */}
        <div className="left-navbar-search-wrapper">
          <div className="left-navbar-search">
            <Search size={14} className="left-navbar-search-icon" aria-hidden="true" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter 25 modules..."
              className="left-navbar-search-input"
              aria-label="Filter modules"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="left-navbar-search-clear"
                aria-label="Clear module filter"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <div className="left-navbar-scroll">
          {/* Top Primary Items */}
          <div className="left-navbar-section top-primary-section">
            {TOP_NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id)
                    onCloseMobile?.()
                  }}
                  className={`left-navbar-item ${
                    isActive ? 'left-navbar-item-active' : ''
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={16} className="left-navbar-item-icon" />
                  <span className="left-navbar-item-label">{label}</span>
                </button>
              )
            })}
          </div>

          {/* Module Categories */}
          {filteredCategories.map((category) => {
            const CategoryIcon = category.icon
            return (
              <div key={category.id} className="left-navbar-category-group">
                <div className="left-navbar-category-title">
                  <CategoryIcon size={13} className="left-navbar-category-icon" />
                  <span>{category.label}</span>
                </div>
                <div className="left-navbar-category-items">
                  {category.modules.map((item) => {
                    const itemActiveId = `module-${item.id}` as const
                    const isActive = activeId === itemActiveId
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onSelect(itemActiveId, item.id)
                          onCloseMobile?.()
                        }}
                        className={`left-navbar-module-item ${
                          isActive ? 'left-navbar-item-active' : ''
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="left-navbar-module-name">{item.name}</span>
                        <span className="left-navbar-module-badge">{item.badge}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {filteredCategories.length === 0 && (
            <div className="left-navbar-no-results">
              <p>No modules match &quot;{filterQuery}&quot;</p>
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="left-navbar-clear-btn"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>

        {/* CMS / Database Quick Link */}
        <div className="p-3 border-t border-white/10 bg-black/20 shrink-0">
          <Link
            href="/cms"
            className="flex items-center justify-between w-full px-3 py-2 rounded-md bg-[#38111e] hover:bg-[#501729] border border-[#a23253]/50 text-[#ebc992] hover:text-white text-xs font-semibold shadow transition"
          >
            <div className="flex items-center gap-2">
              <Database size={15} />
              <span>Database CMS</span>
            </div>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/40 text-[#7ee787]">
              Tables
            </span>
          </Link>
        </div>
      </aside>
    </>
  )
}
