'use client'

import { useState, useMemo, useEffect, type FormEvent } from 'react'
import {
  FileText,
  Table,
  ShieldCheck,
  Plus,
  ArrowDownToLine,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileEdit,
  ExternalLink,
  Eye,
  Trash2,
  X,
  LockKeyhole,
  Check,
} from 'lucide-react'
import type { RecordType } from './accreditation-dictionary'
import { FieldDictionary } from './accreditation-dictionary'
import { shared } from '@/lib/modules'
import { DEMO_RECORDS } from '@/lib/mock-demo-data'
import type { RecordDetail } from '@/lib/accreditation-api'

interface ModuleViewProps {
  record: RecordType
  categoryName?: string
  academicYear?: string
  onOpenRecordsDesk?: () => void
  onExportCsv?: () => void
  isRealUser?: boolean
  userStaff?: any
}

export function ModuleView({
  record,
  categoryName = 'Accreditation Module',
  academicYear = 'AY 2025-26',
  isRealUser = false,
  userStaff,
}: ModuleViewProps) {
  const [activeTab, setActiveTab] = useState<'records' | 'schema'>('records')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Verified' | 'Submitted' | 'Draft' | 'Rejected'>('All')

  // Live Records in State
  const [moduleRecords, setModuleRecords] = useState<RecordDetail[]>([])
  const [selectedRecord, setSelectedRecord] = useState<RecordDetail | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Initialize or re-sync records when record.id or isRealUser changes
  useEffect(() => {
    if (isRealUser) {
      // Real user account: strictly isolated from mock demo data!
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem('pu_real_records') : null
        const list: RecordDetail[] = stored ? JSON.parse(stored) : []
        const userRecords = list.filter((r) => r.type_id === record.id)
        setModuleRecords(userRecords)
      } catch {
        setModuleRecords([])
      }
    } else {
      // Demo guest access (Dr. Arvind Gokhale) only
      const existing = DEMO_RECORDS.filter((r) => r.type_id === record.id)
      setModuleRecords(existing)
    }
    setSearchTerm('')
    setStatusFilter('All')
    setSelectedRecord(null)
    setIsAddModalOpen(false)
  }, [record.id, isRealUser])

  // Helper to persist changes to real records store
  const persistRealRecords = (updatedModuleList: RecordDetail[]) => {
    if (!isRealUser) return
    try {
      const stored = localStorage.getItem('pu_real_records')
      const all: RecordDetail[] = stored ? JSON.parse(stored) : []
      const others = all.filter((r) => r.type_id !== record.id)
      localStorage.setItem('pu_real_records', JSON.stringify([...updatedModuleList, ...others]))
      window.dispatchEvent(new Event('pu_records_changed'))
    } catch {}
  }

  // Toast auto-clear
  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => setToastMessage(null), 3500)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Compute stats
  const stats = useMemo(() => {
    const total = moduleRecords.length
    const verified = moduleRecords.filter((r) => r.status === 'Verified').length
    const submitted = moduleRecords.filter((r) => r.status === 'Submitted').length
    const draft = moduleRecords.filter((r) => r.status === 'Draft').length
    const rejected = moduleRecords.filter((r) => r.status === 'Rejected').length
    return { total, verified, submitted, draft, rejected }
  }, [moduleRecords])

  // Filter records by search and status
  const filteredRecords = useMemo(() => {
    return moduleRecords.filter((row) => {
      if (statusFilter !== 'All' && row.status !== statusFilter) return false
      if (!searchTerm.trim()) return true

      const query = searchTerm.toLowerCase()
      // Search in details values
      const detailsValues = Object.values(row.details || {})
        .map((v) => String(v).toLowerCase())
        .join(' ')
      const meta = `${row.programme || ''} ${row.department || ''} ${row.status} ${row.remarks || ''}`.toLowerCase()

      return detailsValues.includes(query) || meta.includes(query)
    })
  }, [moduleRecords, statusFilter, searchTerm])

  // Determine top 4-5 dynamic columns from record.columns / record.fields to display in table
  const displayColumns = useMemo(() => {
    return record.columns
      .map((col, idx) => ({
        key: col.key,
        label: record.fields[idx] || col.key,
        type: col.type,
      }))
      .slice(0, 5)
  }, [record])

  // Handlers
  const handleVerify = (recId: string) => {
    const updated = moduleRecords.map((r) =>
      r.id === recId ? { ...r, status: 'Verified' as const } : r
    )
    setModuleRecords(updated)
    persistRealRecords(updated)
    if (selectedRecord?.id === recId) {
      setSelectedRecord((prev) => (prev ? { ...prev, status: 'Verified' as const } : null))
    }
    setToastMessage('Record marked as Verified by IQAC Coordinator.')
  }

  const handleReject = (recId: string) => {
    const reason = window.prompt('Enter rejection remark/observation for this record:', 'Please attach supporting verification certificate.')
    if (reason === null) return

    const updated = moduleRecords.map((r) =>
      r.id === recId ? { ...r, status: 'Rejected' as const, remarks: reason } : r
    )
    setModuleRecords(updated)
    persistRealRecords(updated)
    if (selectedRecord?.id === recId) {
      setSelectedRecord((prev) =>
        prev ? { ...prev, status: 'Rejected' as const, remarks: reason } : null
      )
    }
    setToastMessage('Record status updated to Rejected with remark.')
  }

  const handleDelete = (recId: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return
    const updated = moduleRecords.filter((r) => r.id !== recId)
    setModuleRecords(updated)
    persistRealRecords(updated)
    if (selectedRecord?.id === recId) setSelectedRecord(null)
    setToastMessage('Record removed from module.')
  }

  // Handle Add Record submit conforming to schema
  const handleAddSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newDetails: Record<string, unknown> = {}

    record.columns.forEach((col) => {
      const val = formData.get(col.key)
      if (val !== null && val !== '') {
        if (col.type === 'boolean') {
          newDetails[col.key] = val === 'yes' || val === 'true'
        } else if (col.type === 'smallint' || col.type === 'integer') {
          newDetails[col.key] = Number(val)
        } else {
          newDetails[col.key] = String(val)
        }
      }
    })

    const proofFile = formData.get('proof_file') as string
    const statusVal = (formData.get('status') as 'Submitted' | 'Draft') || 'Submitted'
    const remarksVal = (formData.get('remarks') as string) || ''
    const deptVal = (formData.get('department') as string) || 'Computer Engineering (COMP)'
    const progVal = (formData.get('programme') as string) || 'B.Tech Computer Engineering'

    const newRecord: RecordDetail = {
      id: `rec-${record.table.substring(0, 4)}-${Date.now().toString().slice(-4)}`,
      type_id: record.id,
      type_name: record.name,
      academic_year_id: 1,
      academic_year: academicYear,
      school_id: userStaff?.school_id || 1,
      school: 'School of Engineering',
      department_id: userStaff?.department_id || 1,
      department: deptVal,
      programme_id: 1,
      programme: progVal,
      status: statusVal,
      actions: ['view', 'export'],
      proof: proofFile ? `https://pillai.edu.in/evidence/${proofFile}` : null,
      remarks: remarksVal,
      can_see_restricted: true,
      evidence: proofFile ? { filename: proofFile } : null,
      links: [],
      details: newDetails,
    }

    const updated = [newRecord, ...moduleRecords]
    setModuleRecords(updated)
    persistRealRecords(updated)
    setIsAddModalOpen(false)
    setToastMessage(`New record added successfully to ${record.name}.`)
  }

  // CSV Export of actual records
  const handleExportCsv = () => {
    const headers = [
      'Record ID',
      'Status',
      'Department',
      'Programme',
      ...record.fields,
      'Proof Document',
      'Remarks',
    ]

    const rows = moduleRecords.map((r) => {
      const colValues = record.columns.map((col) => {
        const val = r.details?.[col.key]
        if (val === null || val === undefined) return ''
        return `"${String(val).replace(/"/g, '""')}"`
      })

      return [
        r.id,
        r.status,
        `"${r.department || ''}"`,
        `"${r.programme || ''}"`,
        ...colValues,
        `"${r.proof || ''}"`,
        `"${r.remarks || ''}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${record.table}_records_${academicYear.replace(/[^a-zA-Z0-9]/g, '_')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const badgeFormatted = String(record.id).padStart(2, '0')

  return (
    <section className="module-view-container" aria-labelledby="module-view-title">
      {/* Toast alert */}
      {toastMessage && (
        <div className="module-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Module Banner */}
      <div className="module-view-hero">
        <div className="module-view-hero-badge">{badgeFormatted}</div>
        <div className="module-view-hero-details">
          <div className="module-view-category-tag">{categoryName}</div>
          <h1 id="module-view-title" className="module-view-hero-title">
            {record.name}
          </h1>
          <p className="module-view-hero-table">
            PostgreSQL Table: <code>accreditation.{record.table}</code>
          </p>

          {/* Quick Metrics KPI bar */}
          <div className="module-kpi-bar">
            <span className="module-kpi-chip total">
              Total: <strong>{stats.total}</strong>
            </span>
            <span className="module-kpi-chip verified">
              <CheckCircle2 size={12} /> Verified: <strong>{stats.verified}</strong>
            </span>
            <span className="module-kpi-chip submitted">
              <Clock size={12} /> Awaiting Review: <strong>{stats.submitted}</strong>
            </span>
            {stats.draft > 0 && (
              <span className="module-kpi-chip draft">
                <FileEdit size={12} /> Draft: <strong>{stats.draft}</strong>
              </span>
            )}
            {stats.rejected > 0 && (
              <span className="module-kpi-chip rejected">
                <AlertCircle size={12} /> Rejected: <strong>{stats.rejected}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="module-view-hero-actions flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="report-btn-primary flex items-center gap-1.5"
            title="Add a new accreditation record conforming to schema"
          >
            <Plus size={15} />
            <span>Add Record</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="report-btn-outline flex items-center gap-1.5"
            title="Export CSV of current records"
          >
            <ArrowDownToLine size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* View Switch Tabs */}
      <div className="module-view-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`module-view-tab-btn ${activeTab === 'records' ? 'module-view-tab-active' : ''}`}
        >
          <Table size={15} />
          <span>Records Workbench ({moduleRecords.length} Records)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schema')}
          className={`module-view-tab-btn ${activeTab === 'schema' ? 'module-view-tab-active' : ''}`}
        >
          <ShieldCheck size={15} />
          <span>Schema & Field Specifications ({record.fields.length} Fields)</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="module-view-content">
        {activeTab === 'records' && (
          <div className="flex flex-col gap-3">
            {/* Control Bar: Search & Status Filters */}
            <div className="module-view-controls">
              <div className="module-search-wrapper">
                <Search className="module-search-icon" size={15} />
                <input
                  type="text"
                  placeholder={`Search ${record.name.toLowerCase()} records by keywords, names, IDs...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="module-search-input"
                />
              </div>

              <div className="module-status-filters">
                {(['All', 'Verified', 'Submitted', 'Draft', 'Rejected'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`module-filter-pill ${statusFilter === st ? 'active' : ''}`}
                  >
                    {st}
                    {st === 'All'
                      ? ` (${stats.total})`
                      : st === 'Verified'
                      ? ` (${stats.verified})`
                      : st === 'Submitted'
                      ? ` (${stats.submitted})`
                      : st === 'Draft'
                      ? ` (${stats.draft})`
                      : ` (${stats.rejected})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Records Table */}
            <div className="module-data-table-card">
              <div className="overflow-x-auto">
                <table className="module-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      {displayColumns.map((col) => (
                        <th key={col.key}>{col.label}</th>
                      ))}
                      <th>Department / Programme</th>
                      <th>Proof & Evidence</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.length > 0 ? (
                      filteredRecords.map((row, idx) => (
                        <tr key={row.id}>
                          <td style={{ color: '#8c7d83', fontWeight: 600 }}>{idx + 1}</td>
                          {displayColumns.map((col) => {
                            const val = row.details?.[col.key]
                            let formatted = '—'
                            if (val !== undefined && val !== null && val !== '') {
                              if (typeof val === 'boolean') formatted = val ? 'Yes' : 'No'
                              else formatted = String(val)
                            }
                            return (
                              <td key={col.key}>
                                <span className="font-medium text-gray-900">{formatted}</span>
                              </td>
                            )
                          })}
                          <td>
                            <div className="text-xs">
                              <span className="font-semibold text-gray-800">{row.department || 'COMP'}</span>
                              {row.programme && (
                                <span className="block text-gray-500 text-[11px]">{row.programme}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {row.proof ? (
                              <a
                                href={row.proof}
                                target="_blank"
                                rel="noreferrer"
                                className="module-proof-link"
                                title={row.evidence?.filename || 'Evidence File'}
                              >
                                <FileText size={12} />
                                <span>{row.evidence?.filename || 'Proof Document'}</span>
                              </a>
                            ) : (
                              <span className="module-proof-missing">
                                <AlertCircle size={11} /> Missing Proof
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`module-status-badge ${
                                row.status === 'Verified'
                                  ? 'verified'
                                  : row.status === 'Submitted'
                                  ? 'submitted'
                                  : row.status === 'Draft'
                                  ? 'draft'
                                  : 'rejected'
                              }`}
                            >
                              {row.status === 'Verified' && <CheckCircle2 size={12} />}
                              {row.status === 'Submitted' && <Clock size={12} />}
                              {row.status === 'Draft' && <FileEdit size={12} />}
                              {row.status === 'Rejected' && <AlertCircle size={12} />}
                              <span>{row.status}</span>
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="module-action-group justify-end">
                              <button
                                type="button"
                                onClick={() => setSelectedRecord(row)}
                                className="module-action-btn"
                                title="View Record Details"
                              >
                                <Eye size={12} />
                                <span>View</span>
                              </button>
                              {row.status !== 'Verified' && (
                                <button
                                  type="button"
                                  onClick={() => handleVerify(row.id)}
                                  className="module-action-btn verify"
                                  title="Verify Record"
                                >
                                  <Check size={12} />
                                  <span>Verify</span>
                                </button>
                              )}
                              {row.status === 'Submitted' && (
                                <button
                                  type="button"
                                  onClick={() => handleReject(row.id)}
                                  className="module-action-btn reject"
                                  title="Reject with remarks"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(row.id)}
                                className="module-action-btn"
                                title="Delete Record"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={displayColumns.length + 4}>
                          <div className="module-empty-state">
                            <Table className="module-empty-icon" size={32} />
                            <h3 className="font-semibold text-gray-700 mb-1">No records found</h3>
                            <p className="text-xs text-gray-500 mb-3">
                              {searchTerm || statusFilter !== 'All'
                                ? 'No records match your filter criteria.'
                                : `No accreditation records entered yet for ${record.name}.`}
                            </p>
                            <button
                              type="button"
                              onClick={() => setIsAddModalOpen(true)}
                              className="report-btn-primary inline-flex items-center gap-1.5"
                            >
                              <Plus size={14} />
                              <span>Add First Record</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Technical Schema Specification Tab */}
        {activeTab === 'schema' && (
          <div className="flex flex-col gap-4">
            <div className="module-field-dictionary-card">
              <FieldDictionary record={record} />
            </div>

            <div className="module-governance-card">
              <h2 className="text-base font-semibold text-gray-800 mb-2">Common Accreditation Fields</h2>
              <p className="text-xs text-gray-500 mb-4">
                These {shared.length} standard audit and workflow fields apply automatically to every record in{' '}
                <code>accreditation.{record.table}</code>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {shared.map((field) => (
                  <div
                    key={field}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700"
                  >
                    {field}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add New Record Conforming to Schema */}
      {isAddModalOpen && (
        <div className="module-modal-overlay" role="dialog" aria-modal="true">
          <div className="module-modal-box">
            <div className="module-modal-header">
              <h3 className="module-modal-title">
                Add Record · {record.name} ({badgeFormatted})
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="module-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="module-modal-body">
                <div className="module-form-grid">
                  {/* Governance fields */}
                  <div className="module-form-group">
                    <label className="module-form-label">Department</label>
                    <select name="department" className="module-form-select" defaultValue="Computer Engineering (COMP)">
                      <option value="Computer Engineering (COMP)">Computer Engineering (COMP)</option>
                      <option value="Information Technology (IT)">Information Technology (IT)</option>
                      <option value="Mechanical Engineering (MECH)">Mechanical Engineering (MECH)</option>
                      <option value="Management Studies (MBA)">Management Studies (MBA)</option>
                    </select>
                  </div>

                  <div className="module-form-group">
                    <label className="module-form-label">Programme</label>
                    <select name="programme" className="module-form-select" defaultValue="B.Tech Computer Engineering">
                      <option value="B.Tech Computer Engineering">B.Tech Computer Engineering</option>
                      <option value="M.Tech Computer Engineering">M.Tech Computer Engineering</option>
                      <option value="B.Tech Information Technology">B.Tech Information Technology</option>
                      <option value="MBA General">MBA General</option>
                    </select>
                  </div>

                  {/* Schema fields dynamically generated */}
                  {record.columns.map((col, idx) => {
                    const label = record.fields[idx] || col.key
                    return (
                      <div key={col.key} className="module-form-group">
                        <label className="module-form-label">
                          <span>{label}</span>
                          {col.restricted && (
                            <span className="restricted-tag">
                              <LockKeyhole size={10} /> Restricted
                            </span>
                          )}
                        </label>

                        {col.type === 'boolean' ? (
                          <select name={col.key} className="module-form-select">
                            <option value="yes">Yes</option>
                            <option value="no">No</option>
                          </select>
                        ) : col.options && col.options.length > 0 ? (
                          <select name={col.key} className="module-form-select">
                            <option value="">Select an option</option>
                            {col.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : col.type === 'smallint' || col.type === 'integer' ? (
                          <input
                            type="number"
                            name={col.key}
                            placeholder="e.g. 2025"
                            className="module-form-input"
                          />
                        ) : col.type === 'date' ? (
                          <input type="date" name={col.key} className="module-form-input" />
                        ) : (
                          <input
                            type="text"
                            name={col.key}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            className="module-form-input"
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Proof Attachment */}
                  <div className="module-form-group">
                    <label className="module-form-label">Proof Document Filename (PDF)</label>
                    <input
                      type="text"
                      name="proof_file"
                      placeholder="e.g. official_verification_document.pdf"
                      defaultValue={`proof_${record.table}_evidence.pdf`}
                      className="module-form-input"
                    />
                  </div>

                  {/* Submission status */}
                  <div className="module-form-group">
                    <label className="module-form-label">Initial Status</label>
                    <select name="status" className="module-form-select" defaultValue="Submitted">
                      <option value="Submitted">Submit for Verification (Recommended)</option>
                      <option value="Draft">Save as Draft</option>
                    </select>
                  </div>

                  <div className="module-form-group full-width">
                    <label className="module-form-label">Audit Remarks / Notes</label>
                    <textarea
                      name="remarks"
                      rows={2}
                      placeholder="Optional notes or remarks regarding verification evidence..."
                      className="module-form-textarea"
                    />
                  </div>
                </div>
              </div>

              <div className="module-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="report-btn-outline"
                >
                  Cancel
                </button>
                <button type="submit" className="report-btn-primary">
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Record Details & Verify/Reject */}
      {selectedRecord && (
        <div className="module-modal-overlay" role="dialog" aria-modal="true">
          <div className="module-modal-box">
            <div className="module-modal-header">
              <div>
                <h3 className="module-modal-title">Record Details · {record.name}</h3>
                <span className="text-xs text-gray-500">ID: {selectedRecord.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="module-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="module-modal-body">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200">
                <div>
                  <span className="text-xs text-gray-500 block">Department & Programme</span>
                  <span className="font-semibold text-gray-900 text-sm">
                    {selectedRecord.department} · {selectedRecord.programme}
                  </span>
                </div>
                <div>
                  <span
                    className={`module-status-badge ${
                      selectedRecord.status === 'Verified'
                        ? 'verified'
                        : selectedRecord.status === 'Submitted'
                        ? 'submitted'
                        : selectedRecord.status === 'Draft'
                        ? 'draft'
                        : 'rejected'
                    }`}
                  >
                    {selectedRecord.status === 'Verified' && <CheckCircle2 size={12} />}
                    {selectedRecord.status === 'Submitted' && <Clock size={12} />}
                    {selectedRecord.status === 'Draft' && <FileEdit size={12} />}
                    {selectedRecord.status === 'Rejected' && <AlertCircle size={12} />}
                    <span>{selectedRecord.status}</span>
                  </span>
                </div>
              </div>

              {/* Field Values Grid conforming to schema */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {record.columns.map((col, idx) => {
                  const label = record.fields[idx] || col.key
                  const val = selectedRecord.details?.[col.key]
                  let formatted = '—'
                  if (val !== undefined && val !== null && val !== '') {
                    if (typeof val === 'boolean') formatted = val ? 'Yes' : 'No'
                    else formatted = String(val)
                  }

                  return (
                    <div key={col.key} className="p-2.5 bg-gray-50 rounded border border-gray-100">
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 mt-0.5 block">
                        {formatted}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Proof Attachment */}
              <div className="p-3 bg-red-50/40 border border-red-100 rounded-md mb-3">
                <span className="text-xs font-bold text-gray-700 block mb-1">Attached Proof Document</span>
                {selectedRecord.proof ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                      <FileText size={14} className="text-red-800" />
                      {selectedRecord.evidence?.filename || 'proof_document.pdf'}
                    </span>
                    <a
                      href={selectedRecord.proof}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-red-900 font-bold hover:underline flex items-center gap-1"
                    >
                      Open Document <ExternalLink size={12} />
                    </a>
                  </div>
                ) : (
                  <span className="text-xs text-red-700 font-medium flex items-center gap-1">
                    <AlertCircle size={13} /> No proof attached to this record
                  </span>
                )}
              </div>

              {/* Remarks */}
              {selectedRecord.remarks && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700">
                  <span className="font-bold block text-gray-800 mb-1">Audit Observation:</span>
                  {selectedRecord.remarks}
                </div>
              )}
            </div>

            <div className="module-modal-footer">
              {selectedRecord.status !== 'Verified' && (
                <button
                  type="button"
                  onClick={() => handleVerify(selectedRecord.id)}
                  className="report-btn-primary flex items-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Verify Record</span>
                </button>
              )}
              {selectedRecord.status === 'Submitted' && (
                <button
                  type="button"
                  onClick={() => handleReject(selectedRecord.id)}
                  className="report-btn-outline text-red-700 border-red-300 hover:bg-red-50 flex items-center gap-1.5"
                >
                  <X size={14} />
                  <span>Reject Record</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="report-btn-outline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
