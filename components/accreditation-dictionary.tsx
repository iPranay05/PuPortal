import { LockKeyhole } from 'lucide-react'
import { shared, systemTables } from '@/lib/modules'

export type RecordType = {id:number;name:string;table:string;fields:string[];columns:{key:string;type:string;options:string[];restricted:boolean}[]}
const systemFields = [
  ['Employee ID','Full Name (Title, First, Middle, Last)','Staff Type','Designation','School','Department','Official Email','Phone (restricted)','Linked Faculty Profile','Account Status','Joining Date','Leaving Date','Last Login','Password Reset Required','Added By','Added On','Edited By','Edited On'],
  ['Role Name','Role Level (Institute / School / Department / Own Records)','Description','Can Verify Records','Can Export Reports','Can See Restricted Fields','Status'],
  ['User','Role','School','Department','Data Types Covered','Valid From','Valid To','Assigned By','Assigned On'],
  ['Role','Data Type','Can View','Can Add','Can Edit Own','Can Edit Any (within scope)','Can Delete','Can Submit','Can Verify','Can Export','Can See Restricted Fields'],
  ['School Name','School Code','Dean','Established Year','Status'],
  ['Department Name','Department Code','School','Head of Department','Established Year','Status'],
  ['Programme Name','Programme Code','Level','Department','Duration (Years)','Status'],
  ['Year Label','Start Date','End Date','Is Current Year','Financial Year Label'],
  ['Date and Time','User','Role Used at the Time','Action','Data Type','Record Reference','Field Changed','Old Value','New Value','Status Before','Status After','Reason or Remark','School','Department','Academic Year','IP Address','Device or Browser','Session ID'],
]

export function FieldDictionary({record}:{record:RecordType}) {
  return <>
    <div className="dialog-heading"><div className="eyebrow section-kicker">RECORD TYPE {String(record.id).padStart(2,'0')}</div><h2 id="dictionary-title">{record.name}</h2><code>accreditation.{record.table}</code></div>
    <details className="common-fields"><summary>{shared.length} shared record fields</summary><ul className="shared-list">{shared.map(f=><li key={f}>{f}</li>)}</ul></details>
    <table className="dictionary-table"><caption className="sr-only">PostgreSQL field definitions</caption><thead><tr><th scope="col">Field</th><th scope="col">PostgreSQL type</th></tr></thead><tbody>{record.fields.map((field,i) => <tr key={field}><td><strong>{field}</strong><small>{record.columns[i].key}</small></td><td><code>{record.columns[i].type}</code>{record.columns[i].restricted&&<span className="restricted"><LockKeyhole size={12}/> Restricted</span>}</td></tr>)}</tbody></table>
  </>
}

export function SystemDictionary({index}:{index:number}) {
  return <><div className="dialog-heading"><div className="eyebrow section-kicker">SYSTEM TABLE {26+index}</div><h2 id="dictionary-title">{systemTables[index]}</h2><p>{index===8?'Append-only history for accreditation review and audit.':'Fields specified in the accreditation system requirements.'}</p></div><ul className="system-fields">{systemFields[index].map(field=><li key={field}>{field}</li>)}</ul></>
}
