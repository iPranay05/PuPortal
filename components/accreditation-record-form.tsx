import { useState, type FormEvent } from 'react'
import type { RecordType } from './accreditation-dictionary'
import { api, errorMessage, type Directory, type RecordDetail, type RecordRow, type StaffProfile } from '@/lib/accreditation-api'

export function RecordForm({catalog,directory,staff,token,record,done,cancel}:{catalog:RecordType[];directory:Directory;staff:StaffProfile;token:string;record?:RecordDetail;done:(id:string)=>void;cancel:()=>void}){
  const included = record ? catalog.filter(t=>t.id===record.type_id) : catalog.filter(t=>staff.add_types.includes(t.id))
  const [type,setType]=useState(record?.type_id ?? included[0]?.id ?? 0)
  const [school,setSchool]=useState(record?.school_id ?? staff.school_id ?? 0)
  const [department,setDepartment]=useState(record?.department_id ?? staff.department_id ?? 0)
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  const definition=included.find(item=>item.id===type)
  const columns=definition?.columns.flatMap((column,i)=>!column.restricted || record?.can_see_restricted ? [{...column,label:definition.fields[i]}] : []) ?? []

  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault()
    setError('');setPending(true)
    const form=new FormData(event.currentTarget)
    try{
      const details:Record<string,unknown>={}
      for(const column of columns){
        if(type===14 && column.key==='grant_year') continue
        const value=String(form.get(column.key) ?? '').trim()
        if(!value){ if(record?.details[column.key]!=null) details[column.key]=null; continue }
        if(column.type==='jsonb'){
          try{details[column.key]=JSON.parse(value)}catch{throw new Error(`${column.label}: enter a valid JSON object or array.`)}
        }else if(column.type==='boolean') details[column.key]=value==='yes'
        else if(column.type==='integer'||column.type==='smallint') details[column.key]=Number(value)
        else details[column.key]=value
      }
      const payload={academic_year_id:Number(form.get('year')),school_id:school,department_id:department,
        programme_id:Number(form.get('programme'))||null,proof:String(form.get('proof')||'')||null,remarks:String(form.get('remarks')||'')||null,details}
      const saved=await api<RecordRow>(record?`/api/records/${record.id}`:'/api/records',token,{method:record?'PATCH':'POST',body:JSON.stringify(record?payload:{...payload,type_id:type})})
      done(saved.id)
    }catch(reason){setError(errorMessage(reason))}finally{setPending(false)}
  }

  return <form className="schema-panel operations-card ops-form" onSubmit={save}>
    <div><div className="eyebrow section-kicker">RECORD ENTRY</div><h2>{record?'Edit draft':'New accreditation record'}</h2><p>Use the shared fields and the PDF field list for this record type.</p></div>
    <div className="ops-fields">
      <label>Record type<select value={type} disabled={!!record} onChange={e=>setType(Number(e.target.value))}>{included.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Academic year<select name="year" required defaultValue={record?.academic_year_id ?? directory.years.find(y=>y.is_current)?.id ?? ''}><option value="">Select an academic year</option>{directory.years.map(y=><option value={y.id} key={y.id}>{y.label}</option>)}</select></label>
      <label>School<select value={school||''} required onChange={e=>{setSchool(Number(e.target.value));setDepartment(0)}}><option value="">Select a school</option>{directory.schools.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
      <label>Department<select value={department||''} required onChange={e=>setDepartment(Number(e.target.value))}><option value="">Select a department</option>{directory.departments.filter(d=>d.school_id===school).map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select></label>
      <label>Programme <span>(optional)</span><select name="programme" key={department} defaultValue={record?.department_id===department?(record?.programme_id??''):''}><option value="">No programme</option>{directory.programmes.filter(p=>p.department_id===department).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
      <label>Proof link <span>(optional)</span><input type="url" name="proof" maxLength={2048} defaultValue={record?.proof??''} placeholder="https://…"/></label>
      <label className="ops-wide">Remarks <span>(optional)</span><textarea name="remarks" rows={2} maxLength={6000} defaultValue={record?.remarks??''}/></label>
    </div>
    <fieldset className="ops-fields" key={type}>
      <legend>Record-specific fields</legend>
      {columns.map(column=>{
        const stored=record?.details[column.key]
        const value=stored==null?'':String(stored)
        const disabled=type===14&&column.key==='grant_year'
        const required=type===4&&column.key==='duration'
        return <label key={column.key}>{column.label}{column.restricted&&<span> (restricted)</span>}
          {column.options.length>0||column.type==='boolean'?<select name={column.key} defaultValue={column.type==='boolean'?(stored==null?'':stored?'yes':'no'):value}><option value="">Not supplied</option>{(column.type==='boolean'?['yes','no']:column.options).map(option=><option key={option} value={option}>{option==='yes'?'Yes':option==='no'?'No':option}</option>)}</select>
            :column.type==='jsonb'?<textarea name={column.key} rows={3} maxLength={32000} placeholder="JSON object or array" defaultValue={stored==null?'':JSON.stringify(stored,null,2)}/>
            :<input name={column.key} disabled={disabled} required={required} maxLength={12000} type={column.type==='date'?'date':column.type==='text'?'text':'number'} min={column.type==='date'||column.type==='text'?undefined:0} step={column.type.startsWith('numeric')?'0.01':undefined} defaultValue={value}/>}
        </label>
      })}
    </fieldset>
    {!directory.years.length&&<p role="status">An administrator must add an academic year, school, and department before records can be saved.</p>}
    {error&&<p className="ops-error" role="alert">{error}</p>}
    <div className="ops-actions"><button className="action solid" disabled={pending||!type||!directory.years.length}>{pending?'Saving…':'Save draft'}</button><button type="button" className="action outline" onClick={cancel}>Cancel</button></div>
  </form>
}
