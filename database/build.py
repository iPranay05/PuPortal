"""Compile the PDF field dictionary to a self-contained PostgreSQL migration."""
import json, re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
records = json.loads((root/'lib/catalog.json').read_text())
names = 'higher_studies placements internships value_added_courses student_certificates scholarships clubs faculty_profiles faculty_programs faculty_interactions publications grants consultancy patents copyrights startups events mous infrastructure best_practices achievements committees policies program_intake faculty_citations'.split()
def literal(s): return "'" + s.replace("'", "''") + "'"
def ident(s): return re.sub(r'[^a-z0-9]+','_',s.lower()).strip('_')[:60]
sql = [(root/'database/core.sql').read_text()]
fields_by_type = {
    (8, 'name'): ('jsonb', []),
    (15, 'published_unpublished'): ('text', ['Published', 'Unpublished']),
    (17, 'themes'): ('jsonb', []),
    (17, 'feedback_collected'): ('boolean', []),
    (19, 'ict_features'): ('jsonb', []),
    (19, 'available'): ('text', ['Yes', 'No', 'NA']),
}
structured = {'Founders','Seed / Angel Funding','Instalments','Previous Experience','PhD Guidance','Outcomes (Measure, Value)','Members','Meetings','Actions Taken','Authors (in order','Collaborating / Sponsoring Agencies','Speakers / Performers','Yearly Activities','Major Equipment','Sanctioned Posts','Gender-wise Count','Total Experience','Signatory from','Faculty Involved','Inventors (','Registration Numbers'}
for rec,table in zip(records,names):
    rec['name']=re.sub(r'(?<=\w)- (?=\w)','-',rec['name'])
    rec['table']=table
    rec['columns']=[]
    n=rec['id']; sql.append(f"INSERT INTO record_types VALUES ({n},{literal(rec['name'])});")
    columns=['record_id uuid PRIMARY KEY',f'type_id smallint GENERATED ALWAYS AS ({n}) STORED']
    if n == 17 and rec['fields'][-1] == 'Average Rating':
        rec['fields'].pop()
    for i,raw in enumerate(rec['fields']):
        label=re.sub(r'(?<=\w)- (?=\w)','-',raw); rec['fields'][i]=label
        name=ident(label.split(' (')[0]); typ='text'; suffix=''; choices=[]
        if '(Yes / No)' in label and 'with Average' not in label: typ='boolean'
        elif any(label.startswith(k+' (') or label==k or (k.endswith(('(','order','from')) and label.startswith(k)) for k in structured): typ='jsonb'
        elif re.search(r'\bDate\b|^Valid (From|To)$|^Renewal Fee Paid Till$',label,re.I) and 'Dates' not in label:typ='date'
        elif re.search(r'^Number of|Count\b|^(Male|Female|Fresh|Renewed) (Students|Members|Beneficiaries)|^Other / Not Disclosed|^Students (Enrolled|Attended|Completed|Certified)|^Total (Citations|Publications)|^Citations$|^[hi][0-9]*-index$|^Times Offered|^Sanctioned Intake|^Lateral Entry Intake|^Seats Filled|^Capacity$|^Awards Received in',label):typ='integer'
        elif re.search(r'^(Graduation Year|Admission Year|Year Established|Sanction Year|PhD Award Year|Grant Year|Year of Registration)$',label.split(' (')[0]):typ='smallint'
        elif re.search(r'Amount|Fee[s]? (per|Without|Received|Pending|Paid$)|Expenditure|Package \(LPA\)|^Stipend$|^Duration \(|^Credits$|^Total Equipment Cost$|^Impact Factor$|Revenue|^Institution Share|^Faculty Share|^Turnover$|^Valuation$|^Income Generated|^Funding Received$|^Grant from Institute|^Usage Hours|^Area$',label,re.I):typ='numeric(16,2)'
        if typ=='text' and re.search(r'\([^()]+ / [^()]+\)$',label) and not any(w in label for w in ['for example','if any','etc.','Linked','Affiliation','Level of','ICT Features']) and label.split(' (')[0] not in ['Authors','Outcomes','Themes','Incubation Support Received','Founders','Registration Numbers','Students Involved','Support Type','Members','Category-wise Count']:
            choices=[x.strip() for x in label.rsplit('(',1)[1][:-1].split(' / ')]
            if len(choices)>1:suffix=' CHECK ('+name+' IN ('+', '.join(map(literal,choices))+'))'
        if (n, name) in fields_by_type:
            typ, choices = fields_by_type[n, name]
            suffix = f' CHECK ({name} IN ({", ".join(map(literal, choices))}))' if choices else ''
        if typ in ['integer','numeric(16,2)']:suffix=f' CHECK ({name} >= 0)'
        if n==4 and label.startswith('Duration (Hours)'):suffix+=' NOT NULL'
        if n==14 and name=='grant_year':suffix=' GENERATED ALWAYS AS (extract(year FROM grant_date)::smallint) STORED'
        if n==21 and name=='description':
            suffix += " CHECK (cardinality(regexp_split_to_array(trim(description), '\\s+')) <= 100)"
        columns.append(f'{name} {typ}{suffix}')
        rec['columns'].append({'key':name,'type':typ,'options':choices,'restricted':'restricted' in label.lower() or (n==16 and name=='founders')})
    if n == 17:
        if rec['fields'][-1] != 'Average Rating':
            rec['fields'].append('Average Rating')
        if not any(c['key'] == 'average_rating' for c in rec['columns']):
            rec['columns'].append({'key':'average_rating','type':'numeric(4,2)','options':[],'restricted':False})
            columns.append('average_rating numeric(4,2) CHECK (average_rating >= 0)')
    keys=[c['key'] for c in rec['columns']]; assert len(keys)==len(set(keys)),table
    if 'start_date' in keys and 'end_date' in keys:columns.append('CHECK(end_date >= start_date)')
    columns.append('FOREIGN KEY(record_id,type_id) REFERENCES records(id,type_id) ON DELETE CASCADE')
    sql.append(f'CREATE TABLE {table} (\n  '+',\n  '.join(columns)+'\n);')
    for field,c in zip(rec['fields'],rec['columns']):sql.append(f"COMMENT ON COLUMN {table}.{c['key']} IS {literal(field)};")
sql += [
    'ALTER TABLE users ADD FOREIGN KEY(faculty_profile_id) REFERENCES faculty_profiles(record_id);',
    (root/'database/operations.sql').read_text().rstrip(),
    'REVOKE ALL ON ALL TABLES IN SCHEMA accreditation FROM PUBLIC;',
    'COMMIT;',
]
(root/'public/accreditation.sql').write_text('\n'.join(sql)+'\n')
(root/'lib/catalog.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
