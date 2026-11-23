'use client'

import { useState, useMemo } from 'react'
import {
  Download,
  Filter,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ExternalLink,
  FileText,
  Printer,
} from 'lucide-react'
import { ACCREDITATION_REPORTS, type AccreditationReport } from './reports-view-types'
import { DEMO_VAC_REPORT } from '@/lib/mock-demo-data'

interface ReportsViewProps {
  onOpenModule?: (moduleId: number) => void
  currentAcademicYear?: string
  isRealUser?: boolean
}

export function ReportsView({
  onOpenModule,
  currentAcademicYear = 'AY 2025-26',
  isRealUser = false,
}: ReportsViewProps) {
  const [selectedReportId, setSelectedReportId] = useState<string>('rep-04') // Default to Value-Added Courses
  const [frameworkFilter, setFrameworkFilter] = useState<string>('All Frameworks')
  const [ayFilter, setAyFilter] = useState<string>('AY 2025-26')
  const [includeAllDept, setIncludeAllDept] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)

  const frameworks = ['All Frameworks', 'NAAC', 'NBA', 'NIRF', 'QS', 'Institutional']
  const academicYears = ['AY 2025-26', 'AY 2024-25', 'AY 2023-24']

  const filteredReports = useMemo(() => {
    if (frameworkFilter === 'All Frameworks') return ACCREDITATION_REPORTS
    return ACCREDITATION_REPORTS.filter((report) =>
      report.frameworks.includes(frameworkFilter)
    )
  }, [frameworkFilter])

  const selectedReport =
    ACCREDITATION_REPORTS.find((r) => r.id === selectedReportId) ||
    ACCREDITATION_REPORTS[0]

  const handleDownload = (type: 'csv' | 'pdf') => {
    setExportNotice(`${type.toUpperCase()} export generated for ${selectedReport.title}.`)
    setTimeout(() => setExportNotice(null), 3000)

    if (type === 'csv') {
      const csv =
        'Academic Year,Dept,Course Name,Code,Duration (Hrs),Enrolled,Completed,Completion %\n' +
        '2025-26,COMP,Applied Generative AI & LLM Systems,VAC-COMP-202,36,118,112,94.9%\n'
      const encodedUri = encodeURI('data:text/csv;charset=utf-8,\uFEFF' + csv)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `${selectedReport.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="reports-split-view-container" aria-label="Accreditation Reports & Exports">
      {/* Page Title & Top Filters */}
      <div className="reports-top-bar">
        <div>
          <h1 className="reports-page-title">Accreditation Reports & Exports</h1>
          <p className="reports-page-sub">
            Ready NAAC, NBA, NIRF, and QS report views with computed metrics and 3-year NBA windows. Restricted fields are always excluded.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            className="reports-select-pill"
          >
            {frameworks.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <select
            value={ayFilter}
            onChange={(e) => setAyFilter(e.target.value)}
            className="reports-select-pill"
          >
            {academicYears.map((ay) => (
              <option key={ay} value={ay}>
                {ay}
              </option>
            ))}
          </select>
        </div>
      </div>

      {exportNotice && (
        <div className="dashboard-alert-banner mb-3">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Two Column Layout matching Screenshot 2 */}
      <div className="reports-split-grid">
        {/* Left List of Report Types */}
        <div className="reports-nav-list-pane">
          {filteredReports.map((report) => {
            const isSelected = selectedReportId === report.id
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReportId(report.id)}
                className={`reports-list-card ${isSelected ? 'selected' : ''}`}
              >
                <div className="reports-card-top-tags">
                  <span className="reports-card-tag">{report.criterion}</span>
                  {report.hasThreeYearWindow && (
                    <span className="reports-card-window">3-Yr Window</span>
                  )}
                </div>
                <strong className="reports-card-name">{report.title}</strong>
              </button>
            )
          })}
        </div>

        {/* Right Active Report Detail Panel matching Screenshot 2 */}
        <div className="reports-detail-pane">
          <div className="reports-detail-header-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="reports-detail-tag">
                  {selectedReport.criterion} · Academic Year: 2025-26
                </span>
                <h2 className="reports-detail-title">{selectedReport.title}</h2>
                <p className="reports-detail-subtitle">{selectedReport.description}</p>
              </div>

              {/* Action Buttons: CSV & PDF */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload('csv')}
                  className="reports-btn-action"
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload('pdf')}
                  className="reports-btn-action"
                >
                  <FileText size={13} />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Filter checkbox */}
            <div className="reports-detail-filter-row">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAllDept}
                  onChange={(e) => setIncludeAllDept(e.target.checked)}
                  className="rounded border-gray-300 text-[#641d31] focus:ring-[#641d31]"
                />
                <span>Include Department (all departments)</span>
              </label>
            </div>

            {/* 3 Metric Summary Boxes matching Screenshot 2 */}
            <div className="reports-metrics-row">
              <div className="reports-summary-box">
                <span className="text-[11px] font-semibold text-gray-500">
                  {selectedReport.id === 'rep-04'
                    ? 'Courses (>= 30h)'
                    : selectedReport.id === 'rep-02'
                    ? 'Total Placed'
                    : 'Total Records'}
                </span>
                <strong className="text-xl font-bold text-gray-900 mt-1 block">
                  {selectedReport.id === 'rep-04'
                    ? '1'
                    : selectedReport.id === 'rep-02'
                    ? '320'
                    : '42'}
                </strong>
              </div>

              <div className="reports-summary-box">
                <span className="text-[11px] font-semibold text-gray-500">
                  {selectedReport.id === 'rep-04'
                    ? 'Total Enrolled'
                    : selectedReport.id === 'rep-02'
                    ? 'Median Package'
                    : 'Verified Records'}
                </span>
                <strong className="text-xl font-bold text-gray-900 mt-1 block">
                  {selectedReport.id === 'rep-04'
                    ? '118'
                    : selectedReport.id === 'rep-02'
                    ? '₹9.2 LPA'
                    : '42'}
                </strong>
              </div>

              <div className="reports-summary-box">
                <span className="text-[11px] font-semibold text-gray-500">
                  {selectedReport.id === 'rep-04'
                    ? 'Overall Completion Rate'
                    : selectedReport.id === 'rep-02'
                    ? 'Placement %'
                    : 'Verification Rate'}
                </span>
                <strong className="text-xl font-bold text-gray-900 mt-1 block">
                  {selectedReport.id === 'rep-04'
                    ? '94.9%'
                    : selectedReport.id === 'rep-02'
                    ? '91.4%'
                    : '100%'}
                </strong>
              </div>
            </div>

            {/* Detailed Table matching Screenshot 2 */}
            <div className="reports-table-container">
              <table className="reports-data-table">
                <thead>
                  {selectedReport.id === 'rep-04' ? (
                    <tr>
                      <th scope="col">Academic Year</th>
                      <th scope="col">Dept</th>
                      <th scope="col">Course Name</th>
                      <th scope="col">Code</th>
                      <th scope="col" className="text-center">Duration (Hrs)</th>
                      <th scope="col" className="text-center">Enrolled</th>
                      <th scope="col" className="text-center">Completed</th>
                      <th scope="col" className="text-center">Completion %</th>
                    </tr>
                  ) : (
                    <tr>
                      <th scope="col">Academic Year</th>
                      <th scope="col">Dept</th>
                      <th scope="col">Record Name</th>
                      <th scope="col">Reference Code</th>
                      <th scope="col" className="text-center">Metric Value</th>
                      <th scope="col" className="text-center">Status</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {selectedReport.id === 'rep-04' ? (
                    DEMO_VAC_REPORT.records.map((r, i) => (
                      <tr key={i}>
                        <td className="text-gray-600">{r.ay}</td>
                        <td className="font-semibold text-gray-800">{r.dept}</td>
                        <td className="font-semibold text-gray-900">{r.courseName}</td>
                        <td className="text-gray-500 font-mono text-xs">{r.code}</td>
                        <td className="text-center text-gray-700">{r.duration}</td>
                        <td className="text-center text-gray-700">{r.enrolled}</td>
                        <td className="text-center text-gray-700">{r.completed}</td>
                        <td className="text-center font-bold text-emerald-700">
                          {r.completionPercent}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="text-gray-600">2025-26</td>
                      <td className="font-semibold text-gray-800">COMP</td>
                      <td className="font-semibold text-gray-900">{selectedReport.title}</td>
                      <td className="text-gray-500 font-mono text-xs">PILLAI-2025-REP</td>
                      <td className="text-center font-bold text-gray-800">100%</td>
                      <td className="text-center font-semibold text-emerald-700">Verified</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
