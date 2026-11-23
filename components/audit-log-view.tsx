'use client'

import { useState, useMemo } from 'react'
import { Shield, RefreshCw } from 'lucide-react'
import { DEMO_AUDIT_LOG } from '@/lib/mock-demo-data'

interface AuditLogViewProps {
  isRealUser?: boolean
  userStaff?: any
}

export function AuditLogView({ isRealUser = false, userStaff }: AuditLogViewProps) {
  const [actionFilter, setActionFilter] = useState('All Actions')
  const [dataTypeFilter, setDataTypeFilter] = useState('All Data Types')
  const [searchRef, setSearchRef] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 500)
  }

  const baseLogs = useMemo(() => {
    if (!isRealUser) return DEMO_AUDIT_LOG
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('pu_real_audit_log') : null
      const list = stored ? JSON.parse(stored) : []
      if (list.length === 0 && userStaff?.name) {
        return [
          {
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            user: userStaff.name,
            role: userStaff.roles?.[0] || 'Faculty',
            action: 'Login',
            dataType: 'Authentication',
            ref: 'pu-auth-session',
            statusBefore: '—',
            statusAfter: 'Active',
            reason: 'Authenticated staff session verified & active',
          },
        ]
      }
      return list
    } catch {
      return []
    }
  }, [isRealUser, userStaff])

  const filteredLogs = baseLogs.filter((item: any) => {
    if (actionFilter !== 'All Actions' && item.action !== actionFilter) return false
    if (dataTypeFilter !== 'All Data Types' && item.dataType !== dataTypeFilter) return false
    if (searchRef && !item.ref?.toLowerCase().includes(searchRef.toLowerCase()) && !item.user?.toLowerCase().includes(searchRef.toLowerCase())) return false
    return true
  })

  return (
    <div className="audit-log-container" aria-label="Immutable Audit Log">
      {/* Header */}
      <div className="audit-log-header">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-[#641d31]" />
            <h1 className="audit-log-title">Immutable Audit Log</h1>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="audit-refresh-btn"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="audit-log-sub">
          Read-only record of creates, edits, deletes, submissions, verifications, rejections, exports, logins, failed logins, and role changes. Restricted to Super Admin and Principal / Director.
        </p>
      </div>

      {/* Filter Bar matching Screenshot 2 */}
      <div className="audit-filter-bar">
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="audit-filter-select"
        >
          <option value="All Actions">All Actions</option>
          <option value="Login">Login</option>
          <option value="Verified">Verified</option>
          <option value="Rejected">Rejected</option>
          <option value="Role Changed">Role Changed</option>
        </select>

        <select
          value={dataTypeFilter}
          onChange={(e) => setDataTypeFilter(e.target.value)}
          className="audit-filter-select"
        >
          <option value="All Data Types">All Data Types</option>
          <option value="users">users</option>
          <option value="scholarships">scholarships</option>
          <option value="faculty_programs">faculty_programs</option>
          <option value="user_role_assignments">user_role_assignments</option>
        </select>

        <input
          type="text"
          placeholder="Record reference..."
          value={searchRef}
          onChange={(e) => setSearchRef(e.target.value)}
          className="audit-filter-input"
        />

        <input
          type="text"
          placeholder="dd-mm-yyyy"
          className="audit-filter-date"
        />

        <input
          type="text"
          placeholder="dd-mm-yyyy"
          className="audit-filter-date"
        />
      </div>

      {/* Audit Log Table matching Screenshot 2 */}
      <div className="dashboard-completeness-card">
        <div className="dashboard-table-wrapper">
          <table className="dashboard-completeness-table audit-table">
            <thead>
              <tr>
                <th scope="col">Date & Time</th>
                <th scope="col">User / Role</th>
                <th scope="col">Action</th>
                <th scope="col">Data Type / Ref</th>
                <th scope="col">Change / Reason</th>
                <th scope="col">IP / Session</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log: any) => (
                <tr key={log.id}>
                  {/* Date & Time */}
                  <td className="font-mono text-xs text-gray-700 whitespace-nowrap">
                    {log.dateTime}
                  </td>

                  {/* User / Role */}
                  <td>
                    <strong className="block text-gray-900 text-xs">{log.user}</strong>
                    <span className="block text-gray-500 text-[11px]">{log.role}</span>
                  </td>

                  {/* Action */}
                  <td>
                    <span
                      className={`status-tag ${
                        log.action === 'Verified'
                          ? 'verified'
                          : log.action === 'Rejected'
                          ? 'rejected'
                          : 'submitted'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>

                  {/* Data Type / Ref */}
                  <td>
                    <strong className="block text-gray-800 text-xs font-mono">{log.dataType}</strong>
                    <span className="block text-gray-500 text-[11px] font-mono">{log.ref}</span>
                  </td>

                  {/* Change / Reason */}
                  <td className="max-w-xs text-xs">
                    {log.change && (
                      <span className="block text-gray-800 font-medium">{log.change}</span>
                    )}
                    {log.reason && (
                      <span className="block text-gray-600 text-[11px] mt-0.5">{log.reason}</span>
                    )}
                    {!log.change && !log.reason && <span className="text-gray-400">—</span>}
                  </td>

                  {/* IP / Session */}
                  <td>
                    <span className="block text-gray-600 font-mono text-[11px]">{log.ip}</span>
                    <span className="block text-gray-400 font-mono text-[10px]">{log.session}</span>
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

