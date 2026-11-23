'use client'

import { useState, useMemo } from 'react'
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  TrendingUp,
  FileText,
  ChevronDown,
  Info,
  CheckCircle2,
} from 'lucide-react'
import {
  DEMO_COMPLETENESS,
  DEMO_MISSING_PROOF,
  DEMO_WAITING_VERIFICATION,
} from '@/lib/mock-demo-data'

interface DashboardOverviewProps {
  onOpenModule?: (moduleId: number) => void
  currentAcademicYear?: string
  isRealUser?: boolean
  userStaff?: any
}

export function DashboardOverview({
  onOpenModule,
  currentAcademicYear = 'AY 2025-26 (Current)',
  isRealUser = false,
  userStaff,
}: DashboardOverviewProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'review' | 'iqac'>('iqac')
  const [verifiedNotice, setVerifiedNotice] = useState<string | null>(null)

  const handleQuickVerify = (title: string) => {
    setVerifiedNotice(`Record "${title}" verified successfully.`)
    setTimeout(() => setVerifiedNotice(null), 3500)
  }

  // Real user records from clean store
  const realRecords = useMemo(() => {
    if (!isRealUser) return []
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('pu_real_records') : null
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }, [isRealUser])

  const verifiedCount = isRealUser ? realRecords.filter((r: any) => r.status === 'Verified').length : 23
  const awaitingCount = isRealUser ? realRecords.filter((r: any) => r.status === 'Submitted').length : 3
  const missingProofCount = isRealUser ? realRecords.filter((r: any) => !r.proof && !r.evidence).length : 2
  const verificationRate = isRealUser
    ? realRecords.length > 0
      ? `${((verifiedCount / realRecords.length) * 100).toFixed(1)}%`
      : '0.0%'
    : '82.1%'

  const missingProofItems = isRealUser
    ? realRecords
        .filter((r: any) => !r.proof && !r.evidence)
        .map((r: any) => ({
          id: r.id,
          type: r.type_name || 'Record',
          category: 'Accreditation',
          subject: r.programme || r.department || 'Evidence missing',
          status: r.status,
          proofStatus: 'Missing',
          moduleId: r.type_id,
        }))
    : DEMO_MISSING_PROOF

  const waitingVerificationItems = isRealUser
    ? realRecords
        .filter((r: any) => r.status === 'Submitted')
        .map((r: any) => ({
          id: r.id,
          type: r.type_name || 'Record',
          dept: r.department || 'Department',
          submittedDate: r.academic_year || 'Current AY',
          title: r.programme || r.id,
          status: 'Submitted',
        }))
    : DEMO_WAITING_VERIFICATION

  const completenessRows = useMemo(() => {
    if (!isRealUser) return DEMO_COMPLETENESS
    return DEMO_COMPLETENESS.map((base) => {
      const recs = realRecords.filter((r: any) => r.type_id === base.moduleId)
      const total = recs.length
      const verified = recs.filter((r: any) => r.status === 'Verified').length
      const submitted = recs.filter((r: any) => r.status === 'Submitted').length
      const draft = recs.filter((r: any) => r.status === 'Draft').length
      const rejected = recs.filter((r: any) => r.status === 'Rejected').length
      return {
        ...base,
        total,
        verified,
        submitted,
        draft,
        rejected,
      }
    })
  }, [isRealUser, realRecords])

  const userRoleDisplay = isRealUser
    ? userStaff?.roles?.join(', ') || 'Faculty'
    : 'Principal / Director'
  const userScopeDisplay = isRealUser
    ? userStaff?.roles?.includes('HOD')
      ? 'Department'
      : userStaff?.roles?.includes('Dean')
      ? 'School'
      : userStaff?.roles?.includes('Super Admin')
      ? 'Institute'
      : 'Own Records'
    : 'Institute'

  return (
    <div className="dashboard-container" aria-label="Accreditation Overview">
      {/* Top Header Row */}
      <div className="dashboard-top-row">
        <div>
          <h1 className="dashboard-title">Accreditation Overview</h1>
          <p className="dashboard-subtitle">
            Active Role: <span className="font-semibold text-gray-800">{userRoleDisplay}</span> · Scope: <span className="font-semibold text-gray-800">{userScopeDisplay}</span>
          </p>
        </div>

        <div className="dashboard-tabs-group">
          <button
            type="button"
            onClick={() => setActiveTab('staff')}
            className={`dashboard-tab-pill ${activeTab === 'staff' ? 'active' : ''}`}
          >
            Staff Home
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`dashboard-tab-pill ${activeTab === 'review' ? 'active' : ''}`}
          >
            HOD / Dean Review
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('iqac')}
            className={`dashboard-tab-pill ${activeTab === 'iqac' ? 'active' : ''}`}
          >
            IQAC Completeness
          </button>
          <div className="dashboard-year-badge">
            <span>{currentAcademicYear}</span>
            <ChevronDown size={13} className="text-gray-500" />
          </div>
        </div>
      </div>

      {verifiedNotice && (
        <div className="dashboard-alert-banner">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>{verifiedNotice}</span>
        </div>
      )}

      {/* 4 Primary Metric Cards */}
      <div className="dashboard-metric-cards-grid">
        <div className="dashboard-stat-card">
          <span className="dashboard-stat-label">Verified Records</span>
          <strong className="dashboard-stat-value">{verifiedCount}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-stat-label">Awaiting Verification</span>
          <strong className="dashboard-stat-value">{awaitingCount}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-stat-label">Records Missing Proof</span>
          <strong className="dashboard-stat-value">{missingProofCount}</strong>
        </div>

        <div className="dashboard-stat-card">
          <span className="dashboard-stat-label">Verification Rate</span>
          <strong className="dashboard-stat-value">{verificationRate}</strong>
        </div>
      </div>

      {/* 2 Split Action Cards */}
      <div className="dashboard-action-panels-grid">
        {/* Left: Records with No Proof Attached */}
        <div className="dashboard-action-card">
          <div className="dashboard-card-title-row">
            <div className="flex items-center gap-2">
              <span className="dashboard-badge-alert">!</span>
              <h2 className="dashboard-card-heading">Records with No Proof Attached</h2>
            </div>
            <span className="dashboard-count-badge">{missingProofItems.length}</span>
          </div>

          <div className="dashboard-action-list">
            {missingProofItems.length > 0 ? (
              missingProofItems.map((item) => (
                <div key={item.id} className="dashboard-action-item">
                  <div className="dashboard-item-text">
                    <span className="dashboard-item-meta">
                      {item.type} · {item.category} · Proof status: {item.proofStatus}
                    </span>
                    <strong className="dashboard-item-subject">{item.subject}</strong>
                  </div>
                  <div className="dashboard-item-controls">
                    <span className={`status-tag ${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                    {onOpenModule && (
                      <button
                        type="button"
                        onClick={() => onOpenModule(item.moduleId)}
                        className="dashboard-link-btn"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-gray-500">
                All clear. No records missing proof attachments.
              </div>
            )}
          </div>
        </div>

        {/* Right: Waiting Longest for Verification */}
        <div className="dashboard-action-card">
          <div className="dashboard-card-title-row">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gray-500" />
              <h2 className="dashboard-card-heading">Waiting Longest for Verification</h2>
            </div>
            <span className="dashboard-count-badge">{waitingVerificationItems.length}</span>
          </div>

          <div className="dashboard-action-list">
            {waitingVerificationItems.length > 0 ? (
              waitingVerificationItems.map((item) => (
                <div key={item.id} className="dashboard-action-item">
                  <div className="dashboard-item-text">
                    <span className="dashboard-item-meta">
                      {item.type} · {item.dept} · Submitted {item.submittedDate}
                    </span>
                    <strong className="dashboard-item-subject">{item.title}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickVerify(item.title)}
                    className="dashboard-verify-btn"
                  >
                    Verify
                  </button>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-gray-500">
                No submissions currently awaiting verification.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Completeness Across All 25 Accreditation Data Types Table */}
      <div className="dashboard-completeness-card">
        <div className="dashboard-completeness-header">
          <Info size={16} className="text-[#641d31]" />
          <h2 className="dashboard-completeness-title">
            Completeness Across All 25 Accreditation Data Types
          </h2>
        </div>

        <div className="dashboard-table-wrapper">
          <table className="dashboard-completeness-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Data Type</th>
                <th scope="col" className="text-center">Total</th>
                <th scope="col" className="text-center">Verified</th>
                <th scope="col" className="text-center">Submitted</th>
                <th scope="col" className="text-center">Draft</th>
                <th scope="col" className="text-center">Rejected</th>
                <th scope="col" className="text-center">Open</th>
              </tr>
            </thead>
            <tbody>
              {completenessRows.map((row) => (
                <tr key={`${row.category}-${row.dataType}`}>
                  <td className="font-medium text-gray-600">{row.category}</td>
                  <td className="font-semibold text-gray-900">{row.dataType}</td>
                  <td className="text-center font-bold text-gray-800">{row.total}</td>
                  <td className="text-center text-emerald-700 font-semibold">{row.verified}</td>
                  <td className="text-center text-blue-700 font-semibold">{row.submitted}</td>
                  <td className="text-center text-amber-700 font-semibold">{row.draft}</td>
                  <td className="text-center text-rose-700 font-semibold">{row.rejected}</td>
                  <td className="text-center">
                    <button
                      type="button"
                      onClick={() => onOpenModule?.(row.moduleId)}
                      className="dashboard-table-view-btn"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

