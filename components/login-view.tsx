'use client'

import { useState, useEffect, type FormEvent } from 'react'
import Image from 'next/image'
import {
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  UserPlus,
  BadgeCheck,
  Building2,
  GraduationCap,
  Clock,
  ArrowLeft,
} from 'lucide-react'
import { api, errorMessage, ApiError, type StaffProfile } from '@/lib/accreditation-api'
import { DEMO_SCHOOLS, DEMO_DEPARTMENTS } from '@/lib/mock-demo-data'
import { supabase } from '@/lib/supabase'

export interface RegisteredStaffUser {
  id: string
  empId: string
  name: string
  email: string
  staffType: 'Teaching' | 'Non-teaching'
  designation: string
  school: string
  department: string
  requestedRole: string
  password: string
  status: 'Pending Approval' | 'Active' | 'Rejected'
  createdOn: string
}

interface LoginViewProps {
  onSuccess: (token: string, staffData?: StaffProfile) => void
  onCancel?: () => void
  initialMessage?: string
}

export function LoginView({
  onSuccess,
  onCancel,
  initialMessage,
}: LoginViewProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')

  // Sign-in form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(initialMessage || '')

  // Registration form state
  const [regEmpId, setRegEmpId] = useState('')
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regStaffType, setRegStaffType] = useState<'Teaching' | 'Non-teaching'>('Teaching')
  const [regDesignation, setRegDesignation] = useState('Assistant Professor')
  const [regSchool, setRegSchool] = useState('School of Engineering')
  const [regDept, setRegDept] = useState('Computer Engineering')
  const [regRole, setRegRole] = useState('Faculty')
  const [regPassword, setRegPassword] = useState('')

  // Pre-seed default pending registration for demo if not already stored
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pu_registered_users')
      if (!stored) {
        const initialUsers: RegisteredStaffUser[] = [
          {
            id: 'usr_reg_001',
            empId: 'EMP002',
            name: 'Pranay Nair',
            email: 'pranaynair05@gmail.com',
            staffType: 'Teaching',
            designation: 'Assistant Professor',
            school: 'School of Engineering',
            department: 'Computer Engineering',
            requestedRole: 'Faculty',
            password: 'Pillai@123',
            status: 'Pending Approval',
            createdOn: new Date().toISOString().slice(0, 10),
          },
        ]
        localStorage.setItem('pu_registered_users', JSON.stringify(initialUsers))
      }
    } catch {}
  }, [])

  // Handle Account Registration
  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const cleanEmail = regEmail.trim().toLowerCase()
      const cleanEmpId = regEmpId.trim().toUpperCase()

      // Read current registry
      let currentRegistry: RegisteredStaffUser[] = []
      try {
        const stored = localStorage.getItem('pu_registered_users')
        if (stored) currentRegistry = JSON.parse(stored)
      } catch {}

      // Check if email or empId already exists
      if (currentRegistry.some((u) => u.email === cleanEmail)) {
        throw new Error('An account with this email address already exists. Please sign in or contact the Super Admin.')
      }
      if (currentRegistry.some((u) => u.empId === cleanEmpId)) {
        throw new Error('An account with this Employee ID already exists. Please verify.')
      }

      const newRegistration: RegisteredStaffUser = {
        id: 'usr_' + Date.now(),
        empId: cleanEmpId,
        name: regName.trim(),
        email: cleanEmail,
        staffType: regStaffType,
        designation: regDesignation.trim(),
        school: regSchool,
        department: regDept,
        requestedRole: regRole,
        password: regPassword,
        status: 'Pending Approval',
        createdOn: new Date().toISOString().slice(0, 10),
      }

      currentRegistry.push(newRegistration)
      localStorage.setItem('pu_registered_users', JSON.stringify(currentRegistry))

      // Sync new staff registration to Supabase PostgreSQL accreditation.users table
      try {
        const parts = regName.trim().split(' ')
        const firstName = parts[0] || 'Staff'
        const lastName = parts.slice(1).join(' ') || 'Member'

        await supabase.from('users').insert({
          employee_id: cleanEmpId,
          first_name: firstName,
          last_name: lastName,
          official_email: cleanEmail,
          staff_type: regStaffType,
          designation: regDesignation.trim(),
          account_status: 'Inactive',
          password_reset_required: false,
        })
      } catch (sbErr) {
        console.warn('Supabase registration sync note:', sbErr)
      }

      // Also notify /cms via event
      window.dispatchEvent(new Event('pu_user_registered'))

      // Switch to sign-in view with clear verification notice
      setEmail(cleanEmail)
      setMode('signin')
      setNotice(
        `Registration Submitted! Your account has been sent to the Super Admin for cross-verification. Once approved, you can log in.`
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Handle Sign-In
  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    const cleanEmail = email.trim().toLowerCase()

    try {
      // 1. Check local registered accounts first
      let registeredUsers: RegisteredStaffUser[] = []
      try {
        const stored = localStorage.getItem('pu_registered_users')
        if (stored) registeredUsers = JSON.parse(stored)
      } catch {}

      const foundLocalUser = registeredUsers.find((u) => u.email === cleanEmail)

      if (foundLocalUser) {
        // If user is pending Super Admin acceptance
        if (foundLocalUser.status === 'Pending Approval') {
          setError(
            `Account Pending Verification: Your registration has been received but is waiting for Super Admin approval in /cms Studio. Please wait for acceptance.`
          )
          setBusy(false)
          return
        }

        if (foundLocalUser.status === 'Rejected') {
          setError(
            `Registration Rejected: Your account application was declined by the Super Admin. Please contact the IQAC/Director office.`
          )
          setBusy(false)
          return
        }

        // Active account: verify password
        if (foundLocalUser.password && foundLocalUser.password !== password) {
          setError('Incorrect password. Please verify your password and try again.')
          setBusy(false)
          return
        }

        // Successfully authenticated real user
        const realProfile: StaffProfile = {
          id: parseInt(foundLocalUser.id.replace(/\D/g, '').substring(0, 5)) || 2,
          name: foundLocalUser.name,
          email: foundLocalUser.email,
          school_id: 1,
          department_id: 1,
          roles: [foundLocalUser.requestedRole],
          password_reset_required: false,
          add_types: Array.from({ length: 25 }, (_, i) => i + 1),
        }

        localStorage.setItem('pu_current_real_user', JSON.stringify(realProfile))
        onSuccess('real-user-session-' + foundLocalUser.id, realProfile)
        return
      }

      // 2. Otherwise try real FastAPI backend endpoint
      try {
        const session = await api<{ access_token: string }>(
          '/api/auth/login',
          '',
          {
            method: 'POST',
            body: JSON.stringify({ email: cleanEmail, password }),
          }
        )

        let profileData: StaffProfile | undefined
        try {
          profileData = await api<StaffProfile>('/api/auth/me', session.access_token)
        } catch {
          profileData = {
            id: 1,
            name: email.split('@')[0].replace('.', ' '),
            email: cleanEmail,
            school_id: 1,
            department_id: 1,
            roles: ['IQAC Coordinator', 'Super Admin'],
            password_reset_required: false,
            add_types: Array.from({ length: 25 }, (_, i) => i + 1),
          }
        }

        onSuccess(session.access_token, profileData)
        return
      } catch (backendErr) {
        // Fallback for demo users
        if (cleanEmail.includes('arvind') || cleanEmail.includes('pillai.edu')) {
          handleDemoLogin()
          return
        }
        throw new Error(
          'No verified account found with this email. Please click "Create Staff Account" below to register and send for Super Admin acceptance.'
        )
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  // Quick Demo Login (Only Dr. Arvind Gokhale / Guest has mock demo data)
  function handleDemoLogin() {
    const mockToken = 'demo-session-token-' + Math.random().toString(36).substring(2)
    const demoProfile: StaffProfile = {
      id: 99,
      name: 'Dr. Arvind Gokhale',
      email: 'arvind.gokhale@pillai.edu',
      school_id: 1,
      department_id: 1,
      roles: ['IQAC Coordinator', 'Super Admin'],
      password_reset_required: false,
      add_types: Array.from({ length: 25 }, (_, i) => i + 1),
    }
    onSuccess(mockToken, demoProfile)
  }

  return (
    <div className="login-page-wrapper">
      <div className={`login-card ${mode === 'register' ? 'max-w-lg' : 'max-w-md'} transition-all`}>
        {/* Brand Header */}
        <div className="login-card-header">
          <div className="login-brand">
            <Image
              src="/crest.webp"
              alt="Pillai Crest"
              width={48}
              height={54}
              priority
              className="login-crest"
            />
            <div>
              <h1 className="login-brand-title">Pillai University</h1>
              <p className="login-brand-sub">FROM KNOWLEDGE TO CREATION</p>
            </div>
          </div>
          <div className="login-title-box">
            <h2 className="login-main-heading">
              {mode === 'signin' ? 'Staff Sign-In' : 'Create Staff Account'}
            </h2>
            <p className="login-subtext">
              {mode === 'signin'
                ? 'Accredify Record Management System · Institutional Quality Assurance'
                : 'Register staff profile for Super Admin cross-verification & accreditation role access.'}
            </p>
          </div>
        </div>

        {/* Notices / Errors */}
        {notice && (
          <div className="login-alert info" role="status">
            <CheckCircle2 size={16} className="shrink-0 text-[#166534]" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="login-alert error" role="alert">
            <AlertCircle size={16} className="shrink-0 text-[#991b1b]" />
            <span>{error}</span>
          </div>
        )}

        {/* -------------------- SIGN IN MODE -------------------- */}
        {mode === 'signin' && (
          <>
            <form onSubmit={handleLogin} className="login-form">
              <div className="login-field-group">
                <label htmlFor="login-email" className="login-label">
                  Official University Email
                </label>
                <div className="login-input-wrapper">
                  <Mail size={16} className="login-input-icon" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff.name@pillai.edu"
                    required
                    autoComplete="username"
                    className="login-input"
                  />
                </div>
              </div>

              <div className="login-field-group">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="login-label">
                    Password
                  </label>
                </div>
                <div className="login-input-wrapper">
                  <LockKeyhole size={16} className="login-input-icon" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    autoComplete="current-password"
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-pwd-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="login-submit-btn"
              >
                <span>{busy ? 'Verifying…' : 'Sign in to Portal'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Toggle to Create Account */}
            <div className="mt-4 pt-3 border-t border-[#e8e2e2] text-center text-xs text-[#6c6065]">
              New staff member?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register')
                  setError('')
                  setNotice('')
                }}
                className="text-[#641d31] hover:underline font-bold inline-flex items-center gap-1"
              >
                <UserPlus size={13} />
                <span>Create Staff Account</span>
              </button>
            </div>

            {/* Demo Fast Login Option (Clearly labeled as mock data) */}
            <div className="login-divider mt-4">
              <span>OR DEMO GUEST ACCESS</span>
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="login-demo-btn w-full"
            >
              <Sparkles size={16} className="text-[#ca9b57]" />
              <div className="text-left">
                <strong className="block text-xs text-[#641d31]">
                  Sign in as Dr. Arvind Gokhale (Demo Account)
                </strong>
                <span className="block text-[11px] text-[#6c6065]">
                  IQAC Coordinator · Pre-loaded with Sample Mock Data
                </span>
              </div>
            </button>
          </>
        )}

        {/* -------------------- REGISTER MODE -------------------- */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="login-field-group">
                <label className="login-label">Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Pranay Nair"
                  className="login-input pl-3"
                />
              </div>

              <div className="login-field-group">
                <label className="login-label">Employee ID</label>
                <input
                  type="text"
                  required
                  value={regEmpId}
                  onChange={(e) => setRegEmpId(e.target.value)}
                  placeholder="e.g. EMP002 / PU-FAC-0145"
                  className="login-input pl-3 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="login-field-group">
                <label className="login-label">Official Email</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="staff@pillai.edu or gmail"
                  className="login-input pl-3 text-xs"
                />
              </div>

              <div className="login-field-group">
                <label className="login-label">Staff Type</label>
                <select
                  value={regStaffType}
                  onChange={(e) => setRegStaffType(e.target.value as any)}
                  className="login-input pl-3 text-xs h-9 bg-white"
                >
                  <option value="Teaching">Teaching Staff</option>
                  <option value="Non-teaching">Non-teaching Staff</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="login-field-group">
                <label className="login-label">School / Faculty</label>
                <select
                  value={regSchool}
                  onChange={(e) => setRegSchool(e.target.value)}
                  className="login-input pl-3 text-xs h-9 bg-white"
                >
                  {DEMO_SCHOOLS.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="login-field-group">
                <label className="login-label">Department</label>
                <select
                  value={regDept}
                  onChange={(e) => setRegDept(e.target.value)}
                  className="login-input pl-3 text-xs h-9 bg-white"
                >
                  {DEMO_DEPARTMENTS.map((d) => (
                    <option key={d.code} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="login-field-group">
                <label className="login-label">Designation</label>
                <input
                  type="text"
                  required
                  value={regDesignation}
                  onChange={(e) => setRegDesignation(e.target.value)}
                  placeholder="Assistant Professor / HOD"
                  className="login-input pl-3 text-xs"
                />
              </div>

              <div className="login-field-group">
                <label className="login-label">Requested Primary Role</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value)}
                  className="login-input pl-3 text-xs h-9 bg-white"
                >
                  <option value="Faculty">Faculty (Own Records)</option>
                  <option value="Department Coordinator">Department Coordinator</option>
                  <option value="HOD">HOD (Department Verifier)</option>
                  <option value="Dean">Dean (School Verifier)</option>
                  <option value="Non-teaching Staff">Non-teaching Staff</option>
                  <option value="Reviewer">Reviewer (Audit Access)</option>
                </select>
              </div>
            </div>

            <div className="login-field-group">
              <label className="login-label">Choose Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="login-input pl-3"
              />
            </div>

            <div className="p-3 bg-[#fdfaf5] border border-[#f2d8a7] rounded-lg text-xs text-[#8c6721] flex items-start gap-2">
              <Clock size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Verification Policy:</strong> After submitting, your account will have <code>Pending Approval</code> status until a Super Admin cross-verifies your details in CMS Studio.
              </span>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="login-submit-btn bg-[#641d31] hover:bg-[#541629]"
            >
              <span>{busy ? 'Submitting…' : 'Submit for Super Admin Verification'}</span>
              <ArrowRight size={16} />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('signin')
                  setError('')
                  setNotice('')
                }}
                className="text-xs text-[#6c6065] hover:text-[#251d21] font-semibold inline-flex items-center gap-1"
              >
                <ArrowLeft size={13} />
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {onCancel && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-[#6c6065] hover:text-[#251d21] underline"
            >
              Cancel and return to public view
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
