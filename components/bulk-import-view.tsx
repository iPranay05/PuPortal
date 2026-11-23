'use client'

import { useState } from 'react'
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
} from 'lucide-react'
import type { RecordType } from './accreditation-dictionary'
import { shared } from '@/lib/modules'

interface BulkImportViewProps {
  catalog: RecordType[]
  initialModuleId?: number
  onNavigateToModule?: (moduleId: number) => void
}

export function BulkImportView({
  catalog,
  initialModuleId = 1,
  onNavigateToModule,
}: BulkImportViewProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<number>(initialModuleId)
  const [fileName, setFileName] = useState<string>('')
  const [fileSize, setFileSize] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [parsedRows, setParsedRows] = useState<number>(0)

  const currentRecord = catalog.find((r) => r.id === selectedModuleId) || catalog[0]

  const handleDownloadTemplate = () => {
    if (!currentRecord) return
    const headers = [...shared, ...currentRecord.fields]
    const sampleRow = headers.map((h) => `Sample ${h}`)
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      headers.join(',') +
      '\n' +
      sampleRow.join(',')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `template_${currentRecord.table}_bulk_import.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setFileSize((file.size / 1024).toFixed(1) + ' KB')
    setIsProcessing(true)
    setImportStatus('idle')

    setTimeout(() => {
      setIsProcessing(false)
      setParsedRows(12) // Simulated parsed rows
      setImportStatus('success')
    }, 600)
  }

  return (
    <section className="bulk-import-container" aria-labelledby="bulk-import-title">
      <div className="reports-page-header">
        <div>
          <h1 id="bulk-import-title" className="reports-main-title">
            Bulk Record Import
          </h1>
          <p className="reports-subtitle">
            Upload verified accreditation datasets in CSV format for automated validation and batch ingestion.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="report-btn-primary"
        >
          <Download size={15} />
          <span>Download CSV Template</span>
        </button>
      </div>

      <div className="bulk-import-grid">
        {/* Step 1: Target Module Selection */}
        <div className="bulk-card">
          <div className="bulk-card-header">
            <span className="bulk-step-badge">1</span>
            <div>
              <h2 className="bulk-card-title">Select Accreditation Module</h2>
              <p className="bulk-card-subtitle">Choose which of the 25 modules to import records into</p>
            </div>
          </div>

          <div className="bulk-select-wrapper">
            <label htmlFor="bulk-module-select" className="bulk-label">
              Target Module:
            </label>
            <select
              id="bulk-module-select"
              value={selectedModuleId}
              onChange={(e) => {
                setSelectedModuleId(Number(e.target.value))
                setImportStatus('idle')
                setFileName('')
              }}
              className="bulk-select"
            >
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {String(item.id).padStart(2, '0')} - {item.name} ({item.table})
                </option>
              ))}
            </select>
          </div>

          {currentRecord && (
            <div className="bulk-module-info">
              <div className="bulk-info-row">
                <span className="text-gray-500">Database Table:</span>
                <code className="text-[#641d31] font-mono text-xs font-semibold">accreditation.{currentRecord.table}</code>
              </div>
              <div className="bulk-info-row">
                <span className="text-gray-500">Specific Fields:</span>
                <span className="text-gray-800 font-semibold">{currentRecord.fields.length} columns</span>
              </div>
              <div className="bulk-info-row">
                <span className="text-gray-500">Shared Institutional Fields:</span>
                <span className="text-gray-800 font-semibold">{shared.length} columns</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Upload CSV File */}
        <div className="bulk-card">
          <div className="bulk-card-header">
            <span className="bulk-step-badge">2</span>
            <div>
              <h2 className="bulk-card-title">Upload CSV File</h2>
              <p className="bulk-card-subtitle">Drag and drop or select your prepared spreadsheet</p>
            </div>
          </div>

          <label className="bulk-dropzone">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            <div className="bulk-dropzone-content">
              <UploadCloud size={38} className="text-[#641d31] mx-auto mb-2" />
              <p className="font-semibold text-gray-800 text-sm">
                Click to browse or drop your CSV file here
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports UTF-8 CSV files up to 15MB
              </p>
            </div>
          </label>

          {isProcessing && (
            <div className="bulk-status-msg text-[#641d31]">
              <p>Validating CSV format and column mappings…</p>
            </div>
          )}

          {importStatus === 'success' && fileName && (
            <div className="bulk-status-box success">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-emerald-800 text-sm">
                  File validated successfully
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  &quot;{fileName}&quot; ({fileSize}) · {parsedRows} records ready for batch ingestion.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

