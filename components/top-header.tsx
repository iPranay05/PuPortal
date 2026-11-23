'use client'

import { useState } from 'react'
import { Menu, ChevronDown, LogOut, LogIn, Check } from 'lucide-react'

interface TopHeaderProps {
  breadcrumb: string[]
  academicYear?: string
  onAcademicYearChange?: (year: string) => void
  userRole?: string
  userName?: string
  isAuthenticated?: boolean
  onToggleMobileNav?: () => void
  onSignOut?: () => void
  onSignIn?: () => void
}

export function TopHeader({
  breadcrumb,
  academicYear = 'AY 2025-26 (Current)',
  onAcademicYearChange,
  userRole = 'IQAC Coordinator · Institute',
  userName = 'Dr. Arvind Gokhale',
  isAuthenticated = true,
  onToggleMobileNav,
  onSignOut,
  onSignIn,
}: TopHeaderProps) {
  const [yearMenuOpen, setYearMenuOpen] = useState(false)
  const years = [
    'AY 2025-26 (Current)',
    'AY 2024-25',
    'AY 2023-24',
    'AY 2022-23',
    'AY 2021-22',
  ]

  return (
    <header className="top-header" aria-label="Portal Header">
      <div className="top-header-left">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            className="top-header-menu-btn lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
        )}

        <nav aria-label="Breadcrumb" className="top-header-breadcrumb">
          <ol className="top-header-breadcrumb-list">
            {breadcrumb.map((crumb, idx) => (
              <li key={idx} className="top-header-breadcrumb-item">
                {idx > 0 && (
                  <span className="top-header-breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                )}
                <span
                  className={
                    idx === breadcrumb.length - 1
                      ? 'top-header-breadcrumb-current'
                      : 'top-header-breadcrumb-parent'
                  }
                >
                  {crumb}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="top-header-right">
        {/* Academic Year Dropdown */}
        <div className="top-header-dropdown-container">
          <button
            type="button"
            onClick={() => setYearMenuOpen(!yearMenuOpen)}
            className="top-header-dropdown-btn"
            aria-expanded={yearMenuOpen}
          >
            <span>{academicYear}</span>
            <ChevronDown size={14} className="top-header-dropdown-icon" />
          </button>

          {yearMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setYearMenuOpen(false)}
                aria-hidden="true"
              />
              <div className="top-header-dropdown-menu">
                {years.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => {
                      onAcademicYearChange?.(yr)
                      setYearMenuOpen(false)
                    }}
                    className={`top-header-dropdown-item ${
                      yr === academicYear ? 'top-header-dropdown-item-active' : ''
                    }`}
                  >
                    <span>{yr}</span>
                    {yr === academicYear && <Check size={14} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* User Role Badge */}
        {isAuthenticated ? (
          <div className="top-header-role-badge">
            <span>{userRole}</span>
          </div>
        ) : (
          <div className="top-header-guest-badge text-xs text-[#8c7d83]">
            <span>Guest Access</span>
          </div>
        )}

        {/* Auth Action: Sign Out or Sign In */}
        {isAuthenticated ? (
          <button
            type="button"
            onClick={onSignOut}
            className="top-header-signout-btn"
            title="Sign Out of Accreditation System"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="top-header-signin-btn"
            title="Sign In to Staff Workspace"
          >
            <LogIn size={14} />
            <span>Staff Sign In</span>
          </button>
        )}
      </div>
    </header>
  )
}
