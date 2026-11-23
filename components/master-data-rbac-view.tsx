'use client'

import { useState } from 'react'
import {
  DEMO_SCHOOLS,
  DEMO_DEPARTMENTS,
  DEMO_PROGRAMMES,
  DEMO_USERS,
} from '@/lib/mock-demo-data'

export function MasterDataRbacView() {
  const [activeTab, setActiveTab] = useState<
    | 'schools'
    | 'departments'
    | 'programmes'
    | 'years'
    | 'users'
    | 'assignments'
    | 'permissions'
  >('schools')

  const tabs = [
    { id: 'schools', label: 'Schools' },
    { id: 'departments', label: 'Departments' },
    { id: 'programmes', label: 'Programmes' },
    { id: 'years', label: 'Academic Years' },
    { id: 'users', label: 'Users' },
    { id: 'assignments', label: 'Role Assignments' },
    { id: 'permissions', label: 'Role Permissions' },
  ] as const

  return (
    <div className="master-data-container" aria-label="Master Data & RBAC">
      {/* Heading */}
      <div className="master-data-header">
        <h1 className="master-data-title">Master Data, Users & RBAC</h1>
        <p className="master-data-sub">
          Manage institutional hierarchy, staff accounts, multi-role assignments, and role_permissions. (Read-only view — switch to Super Admin to edit.)
        </p>
      </div>

      {/* Tab Pills matching Screenshot 1 */}
      <div className="master-data-tabs-row">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`master-data-tab-pill ${
              activeTab === tab.id ? 'active' : ''
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Section */}
      <div className="master-data-table-card">
        {activeTab === 'schools' && (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-completeness-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">School Name</th>
                  <th scope="col">Dean</th>
                  <th scope="col">Established</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_SCHOOLS.map((school) => (
                  <tr key={school.code}>
                    <td className="font-semibold text-gray-900">{school.code}</td>
                    <td className="font-medium text-gray-800">{school.name}</td>
                    <td className="text-gray-700">{school.dean}</td>
                    <td className="text-gray-600">{school.established}</td>
                    <td>
                      <span className="status-tag verified">{school.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'departments' && (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-completeness-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Department Name</th>
                  <th scope="col">School</th>
                  <th scope="col">HOD</th>
                  <th scope="col">Established</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_DEPARTMENTS.map((dept) => (
                  <tr key={dept.code}>
                    <td className="font-semibold text-gray-900">{dept.code}</td>
                    <td className="font-medium text-gray-800">{dept.name}</td>
                    <td className="text-gray-700">{dept.school}</td>
                    <td className="text-gray-700">{dept.hod}</td>
                    <td className="text-gray-600">{dept.established}</td>
                    <td>
                      <span className="status-tag verified">{dept.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'programmes' && (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-completeness-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Programme Name</th>
                  <th scope="col">Level</th>
                  <th scope="col">Department</th>
                  <th scope="col">Duration (Yrs)</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_PROGRAMMES.map((prog) => (
                  <tr key={prog.code}>
                    <td className="font-semibold text-gray-900">{prog.code}</td>
                    <td className="font-medium text-gray-800">{prog.name}</td>
                    <td className="text-gray-700">{prog.level}</td>
                    <td className="text-gray-700">{prog.dept}</td>
                    <td className="text-gray-600">{prog.duration}</td>
                    <td>
                      <span className="status-tag verified">{prog.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="dashboard-table-wrapper">
            <table className="dashboard-completeness-table">
              <thead>
                <tr>
                  <th scope="col">Emp ID</th>
                  <th scope="col">Staff Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Primary Role</th>
                  <th scope="col">Department</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map((user) => (
                  <tr key={user.empId}>
                    <td className="font-mono text-xs text-gray-600">{user.empId}</td>
                    <td className="font-semibold text-gray-900">{user.name}</td>
                    <td className="text-gray-600 text-xs">{user.email}</td>
                    <td className="font-medium text-gray-800">{user.role}</td>
                    <td className="text-gray-700">{user.dept}</td>
                    <td>
                      <span className="status-tag verified">{user.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(activeTab === 'years' || activeTab === 'assignments' || activeTab === 'permissions') && (
          <div className="p-6 text-center text-gray-500 text-xs">
            <p className="font-semibold text-gray-700 mb-1">
              Active Institutional Configuration
            </p>
            <p>
              Displaying permissions for current session. Switch to Super Admin credentials to modify role policies.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

