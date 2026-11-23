'use client'

import { useState, type FormEvent } from 'react'
import useSWR from 'swr'
import { ArrowDownToLine, ArrowUpRight, ChevronRight, FileText, LockKeyhole, Plus } from 'lucide-react'
import { api, apiResponse, ApiError, downloadFile, errorMessage, type Directory, type RecordDetail, type RecordRow, type StaffProfile } from '@/lib/accreditation-api'
import type { RecordType } from './accreditation-dictionary'
import { RecordForm } from './accreditation-record-form'

type Availability = {status:'ready'|'schema_missing'|'not_configured'|'unavailable'}
type Summary = {type_name:string;type_id:number;status:RecordRow['status'];total:number}[]

export function AccreditationRecords({catalog,active}:{catalog:RecordType[];active:boolean}){
  const [token,setToken]=useState('')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const health=useSWR(active?'/api/status':null,(path)=>api<Availability>(path),{shouldRetryOnError:false})
  const staff=useSWR(token?['/api/auth/me',token]:null,([path,key])=>api<StaffProfile>(path,key),{shouldRetryOnError:false})
  const isReady=health.data?.status==='ready'

  async function signIn(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    const form=new FormData(event.currentTarget)
    try{const session=await api<{access_token:string}>('/api/auth/login','',{method:'POST',body:JSON.stringify({email:form.get('email'),password:form.get('password')})});setToken(session.access_token)}
    catch(reason){setError(errorMessage(reason))}finally{setBusy(false)}
  }

  async function signOut(){
    setBusy(true);setError('')
    try { await api('/api/auth/logout',token,{method:'POST'}) }
    catch(reason) { if(!(reason instanceof ApiError&&reason.status===401)) setNotice('Signed out on this page. The server could not confirm session revocation.') }
    finally { setToken('');setBusy(false) }
  }

  async function changePassword(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('')
    const form=new FormData(event.currentTarget)
    try{await api('/api/auth/password',token,{method:'POST',body:JSON.stringify({current_password:form.get('current'),new_password:form.get('password')})});setToken('');setNotice('Password changed. Sign in again with your new password.')}
    catch(reason){setError(errorMessage(reason))}finally{setBusy(false)}
  }

  return <section aria-labelledby="records-title">
    <div className="interior-heading schema-heading ops-heading">
      <div><div className="eyebrow section-kicker">STAFF WORKSPACE</div><h1 id="records-title">Accreditation Records</h1><p>Create evidence records, submit drafts for review, and export verified data.</p></div>
      <a className="action outline" href="/api/docs" target="_blank" rel="noreferrer">FastAPI reference <ArrowUpRight size={16}/></a>
    </div>
    {health.isLoading&&<p role="status">Checking the FastAPI connection…</p>}
    {!isReady&&!health.isLoading&&<div className="schema-panel operations-card ops-offline" role="status">
      <div className="stat-icon golden"><LockKeyhole size={20}/></div><div><h2>{health.data?.status==='not_configured'?'PostgreSQL is not connected':health.data?.status==='schema_missing'?'Accreditation schema is not installed':'FastAPI is unavailable'}</h2>
        <p>{health.data?.status==='not_configured'?'This preview has no database connection. Live records and staff sign-in are disabled; the PDF field catalog and PostgreSQL schema download are still available.':health.data?.status==='schema_missing'?'The database is reachable, but the accreditation tables must be installed before staff can sign in.':'Live records cannot be loaded right now. The record catalog and schema download are still available.'}</p>
        <div className="ops-actions"><a className="action outline" href="/accreditation.sql" download="pillai-accreditation.sql"><ArrowDownToLine size={16}/> Download PostgreSQL schema</a><button className="text-link" onClick={()=>health.mutate()}>Check connection again</button></div></div>
    </div>}
    {notice&&<p role="status" className="ops-notice">{notice}</p>}
    {error&&<p role="alert" className="ops-error">{error}</p>}
    {isReady&&!token&&<form className="schema-panel operations-card ops-form ops-auth" onSubmit={signIn}>
      <div><h2>Staff sign-in</h2><p>Use your university account. Student accounts are not supported.</p></div>
      <label>Official email<input name="email" type="email" autoComplete="username" maxLength={254} required/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={128} required/></label>
      <button className="action solid" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form>}
    {token&&staff.isLoading&&<p role="status">Loading staff access…</p>}
    {token&&staff.error&&<div className="ops-actions"><p role="alert">{errorMessage(staff.error)}</p><button className="action outline" onClick={()=>setToken('')}>Back to sign-in</button></div>}
    {staff.data&&<div className="schema-panel operations-card ops-account"><div><strong>{staff.data.name}</strong><p>{staff.data.roles.join(' · ')||'No current role assignments'}</p></div><button className="action outline" onClick={signOut} disabled={busy}>Sign out</button></div>}
    {staff.data?.password_reset_required&&<form className="schema-panel operations-card ops-form ops-auth" onSubmit={changePassword}>
      <div><h2>Change temporary password</h2><p>Set a new password before accessing accreditation records.</p></div>
      <label>Temporary password<input name="current" type="password" autoComplete="current-password" required maxLength={128}/></label>
      <label>New password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/></label>
      <button className="action solid" disabled={busy}>{busy?'Saving…':'Change password'}</button>
    </form>}
    {staff.data&&!staff.data.password_reset_required&&<RecordsDesk catalog={catalog} token={token} staff={staff.data}/>}
  </section>
}

function RecordsDesk({catalog,staff,token}:{catalog:RecordType[];staff:StaffProfile;token:string}){
  const [type,setType]=useState('')
  const [year,setYear]=useState('')
  const [state,setState]=useState('')
  const [offset,setOffset]=useState(0)
  const [view,setView]=useState<'list'|'reports'|'new'|'edit'|'detail'>('list')
  const [selected,setSelected]=useState<string|null>(null)
  const [error,setError]=useState('')
  const [feedback,setFeedback]=useState('')
  const [busy,setBusy]=useState(false)
  const filters=new URLSearchParams({limit:'25',offset:String(offset)})
  if(type)filters.set('type_id',type)
  if(year)filters.set('academic_year_id',year)
  if(state)filters.set('status',state)
  const directory=useSWR(['/api/directory',token],([path,key])=>api<Directory>(path,key))
  const rows=useSWR([`/api/records?${filters}`,token],([path,key])=>api<{items:RecordRow[];has_more:boolean}>(path,key),{shouldRetryOnError:false})
  const detail=useSWR(selected?[`/api/records/${selected}`,token]:null,([path,key])=>api<RecordDetail>(path,key),{revalidateOnFocus:false,shouldRetryOnError:false})
  const reports=useSWR(view==='reports'?[`/api/reports/summary${year?`?academic_year_id=${year}`:''}`,token]:null,([path,key])=>api<Summary>(path,key),{shouldRetryOnError:false})

  function open(id:string){setSelected(id);setView('detail');setError('');setFeedback('')}
  function back(){setSelected(null);setView('list');setError('');setFeedback('')}
  function saved(id:string){open(id);void rows.mutate();if(id===selected)void detail.mutate();setFeedback('Draft saved.')}

  async function perform(action:()=>Promise<unknown>,message:string){
    setBusy(true);setError('');setFeedback('')
    try{await action();setFeedback(message)}catch(reason){setError(errorMessage(reason))}finally{setBusy(false)}
  }

  if((view==='new'||view==='edit')&&directory.data&&(view==='new'||detail.data))return <RecordForm catalog={catalog} directory={directory.data} token={token} staff={staff} record={view==='edit'?detail.data:undefined} done={saved} cancel={view==='edit'?()=>setView('detail'):back}/>

  const record=detail.data
  const definition=catalog.find(item=>item.id===record?.type_id)
  return <div className="ops-stack">
    <div className="ops-actions">
      <button className={`action ${view==='list'?'solid':'outline'}`} aria-pressed={view==='list'} onClick={back}>Record queue</button>
      <button className={`action ${view==='reports'?'solid':'outline'}`} aria-pressed={view==='reports'} onClick={()=>{setView('reports');setError('');setFeedback('')}}>Reports</button>
      {!!staff.add_types.length&&<button className="action outline" disabled={!directory.data} onClick={()=>setView('new')}><Plus size={17}/> New record</button>}
      {staff.roles.some(role=>['Super Admin','Principal / Director'].includes(role))&&<span className="ops-help">Administration and audit endpoints are in the FastAPI reference.</span>}
    </div>
    {error&&<p className="ops-error" role="alert">{error}</p>}{feedback&&<p className="ops-notice" role="status">{feedback}</p>}
    {directory.error&&<p className="ops-error" role="alert">{errorMessage(directory.error)}</p>}
    {(view==='list'||view==='reports')&&<div className="schema-panel operations-card ops-fields">
      <label>Record type<select value={type} onChange={e=>{setType(e.target.value);setOffset(0)}}><option value="">All record types</option>{catalog.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Academic year<select value={year} onChange={e=>{setYear(e.target.value);setOffset(0)}}><option value="">All academic years</option>{directory.data?.years.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {view==='list'&&<label>Review status<select value={state} onChange={e=>{setState(e.target.value);setOffset(0)}}><option value="">All statuses</option>{['Draft','Submitted','Verified'].map(s=><option key={s}>{s}</option>)}</select></label>}
    </div>}
    {view==='list'&&<>
      {rows.error?<p role="alert">{errorMessage(rows.error)}</p>:rows.isLoading?<p role="status">Loading records…</p>:rows.data?.items.length?<div className="record-list">{rows.data.items.map(item=><button key={item.id} className="record-row" onClick={()=>open(item.id)}><span className="record-number"><FileText size={17}/></span><span><strong>{item.type_name}</strong><small>{item.academic_year} · {item.department} · {item.id.slice(0,8)}</small></span><span className="field-count">{item.status}</span><ChevronRight size={17}/></button>)}</div>:<div className="empty-state"><h2>No records in this view</h2><p>Adjust the filters or create a draft if your role permits it.</p></div>}
      {(offset>0||rows.data?.has_more)&&<div className="ops-actions"><button className="action outline" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-25))}>Previous page</button><button className="action outline" disabled={!rows.data?.has_more} onClick={()=>setOffset(offset+25)}>Next page</button></div>}
    </>}
    {view==='reports'&&<div className="schema-panel operations-card ops-stack"><div><h2>Accreditation summary</h2><p>Review counts are scoped to your staff account. CSV exports include verified records only.</p></div>
      <div className="ops-actions"><button className="action solid" disabled={!type||!year||busy} onClick={()=>perform(async()=>{const response=await apiResponse(`/api/reports/export?type_id=${type}&academic_year_id=${year}`,token);downloadFile(await response.blob(),`accreditation-${type}-${year}.csv`)},'Report downloaded.')}>Export verified CSV</button>{(!type||!year)&&<span className="ops-help">Select a record type and academic year to export.</span>}</div>
      {reports.error?<p role="alert">{errorMessage(reports.error)}</p>:reports.isLoading?<p role="status">Loading report…</p>:<table className="dictionary-table"><thead><tr><th scope="col">Record type</th><th scope="col">Status</th><th scope="col">Count</th></tr></thead><tbody>{reports.data?.filter(item=>!type||item.type_id===Number(type)).map(item=><tr key={`${item.type_id}-${item.status}`}><td>{item.type_name}</td><td>{item.status}</td><td>{item.total}</td></tr>)}</tbody></table>}
    </div>}
    {view==='detail'&&<>{detail.error&&<p role="alert">{errorMessage(detail.error)}</p>}{detail.isLoading&&<p role="status">Loading record…</p>}{record&&<RecordReview key={record.id} record={record} definition={definition} token={token} busy={busy} onEdit={()=>setView('edit')} perform={perform} refresh={()=>{void detail.mutate();void rows.mutate()}} onDelete={()=>{back();void rows.mutate()}} open={open}/>}</>}
  </div>
}

function RecordReview({record,definition,token,busy,onEdit,perform,refresh,onDelete,open}:{record:RecordDetail;definition?:RecordType;token:string;busy:boolean;onEdit:()=>void;perform:(action:()=>Promise<unknown>,message:string)=>Promise<void>;refresh:()=>void;onDelete:()=>void;open:(id:string)=>void}){
  const path=`/api/records/${record.id}`
  const [action,setAction]=useState('')
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const form=new FormData(event.currentTarget)
    await perform(async()=>{
      if(action==='delete') { await api(path,token,{method:'DELETE',body:JSON.stringify({reason:form.get('reason')})});onDelete();return }
      if(action==='reject') await api(`${path}/reject`,token,{method:'POST',body:JSON.stringify({reason:form.get('reason')})})
      if(action==='assign') await api(`${path}/reviewers`,token,{method:'PUT',body:JSON.stringify({user_id:Number(form.get('reviewer'))})})
      if(action==='link') await api(`${path}/links`,token,{method:'POST',body:JSON.stringify({target_id:form.get('target'),relationship:form.get('relationship')})})
      if(action==='evidence'){
        const file=form.get('file')
        if(!(file instanceof File)||!file.size||file.size>3145728)throw new Error('Choose an evidence file no larger than 3 MB.')
        const bytes=new Uint8Array(await file.arrayBuffer())
        const segments=[]
        for(let index=0;index<bytes.length;index+=16384)segments.push(String.fromCharCode(...bytes.subarray(index,index+16384)))
        await api(`${path}/evidence`,token,{method:'PUT',body:JSON.stringify({filename:file.name,content_type:file.type,content_base64:btoa(segments.join(''))})})
      }
      setAction('');refresh()
    },action==='delete'?'Draft deleted.':'Record updated.')
  }
  const allowed=record.actions
  let proof:URL|null=null
  try{if(record.proof){const candidate=new URL(record.proof);if(['https:','http:'].includes(candidate.protocol))proof=candidate}}catch{}
  return <article className="schema-panel operations-card ops-stack">
    <div><div className="eyebrow section-kicker">{record.status.toUpperCase()} · {record.id.slice(0,8)}</div><h2>{record.type_name}</h2>{record.remarks&&<p>{record.remarks}</p>}</div>
    <div className="ops-actions">
      {allowed.includes('edit')&&<button className="action outline" onClick={onEdit}>Edit draft</button>}
      {['submit','verify'].filter(name=>allowed.includes(name)).map(name=><button className="action solid" key={name} disabled={busy} onClick={()=>perform(async()=>{await api(`${path}/${name}`,token,{method:'POST'});refresh()},name==='submit'?'Submitted for review.':'Record verified.')}>{name==='submit'?'Submit for review':'Verify record'}</button>)}
      {(allowed.includes('edit')?['evidence','link',...allowed]:allowed).filter(name=>['reject','delete','assign','link','evidence'].includes(name)).map(name=><button className="action outline" key={name} disabled={busy} onClick={()=>setAction(name)}>{({reject:'Return to draft',delete:'Delete draft',assign:'Assign IQAC reviewer',link:'Link a record',evidence:'Upload evidence'})[name]}</button>)}
    </div>
    {action&&<form className="ops-form" onSubmit={submit}>
      {action==='delete'||action==='reject'?<label>Reason<textarea name="reason" rows={2} maxLength={2000} required/></label>:action==='assign'?<label>IQAC member staff ID<input name="reviewer" type="number" min={1} required/></label>:action==='link'?<div className="ops-fields"><label>Target record ID<input name="target" required maxLength={36}/></label><label>Relationship<input name="relationship" required maxLength={80}/></label></div>:<label>Evidence file (PDF, PNG, JPEG, or TXT, up to 3 MB)<input type="file" name="file" accept="application/pdf,image/png,image/jpeg,text/plain" required/></label>}
      <div className="ops-actions"><button className="action solid" disabled={busy}>{action==='delete'?'Confirm deletion':'Confirm'}</button><button className="action outline" type="button" onClick={()=>setAction('')}>Cancel</button></div>
    </form>}
    {proof&&<a className="text-link" href={proof.href} target="_blank" rel="noreferrer">Open proof link <ArrowUpRight size={15}/></a>}
    {record.evidence&&<button className="text-link" disabled={busy} onClick={()=>perform(async()=>{const response=await apiResponse(`${path}/evidence`,token);downloadFile(await response.blob(),record.evidence!.filename)},'Evidence downloaded.')}>Download {record.evidence.filename} <ArrowDownToLine size={15}/></button>}
    {record.links.length>0&&<ul className="ops-stack">{record.links.map(link=><li key={`${link.id}-${link.relationship}`}><button className="text-link" onClick={()=>open(link.id)}>{link.relationship} · {link.id.slice(0,8)}</button></li>)}</ul>}
    <dl className="ops-detail">
      {definition?.columns.map((column,index)=>Object.hasOwn(record.details,column.key)?<div key={column.key}><dt>{definition.fields[index]}</dt><dd>{record.details[column.key]==null?'Not supplied':typeof record.details[column.key]==='object'?JSON.stringify(record.details[column.key]):typeof record.details[column.key]==='boolean'?(record.details[column.key]?'Yes':'No'):String(record.details[column.key])}</dd></div>:null)}
    </dl>
  </article>
}
