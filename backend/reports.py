import csv
from io import StringIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from .access import ADMIN, PRINCIPAL, grants_for, require_named, sql_scope
from .auth import require_staff
from .db import TYPES, as_json, audit, connection
from .records import record_details

router = APIRouter(prefix='/api', tags=['Reports and audit'])


def csv_cell(value):
    if value is None:
        return ''
    if isinstance(value,(dict,list)):
        value = as_json(value)
    if isinstance(value,str) and (value[:1] in ('\t','\n','\r') or value.lstrip()[:1] in ('=','+','-','@')):
        return "'" + value
    return value


@router.get('/reports/summary')
async def summary(academic_year_id: Optional[int] = Query(None, gt=0), staff=Depends(require_staff), conn=Depends(connection)):
    rows = await conn.fetch(f'''SELECT r.type_id,r.status,count(*) AS total FROM records r WHERE {sql_scope(1,2)}
        AND ($3::bigint IS NULL OR r.academic_year_id=$3) GROUP BY r.type_id,r.status ORDER BY r.type_id,r.status''',
        [dict(g) for g in staff.grants], staff.id, academic_year_id)
    return [{**dict(row), 'type_name': TYPES[row['type_id']]['name']} for row in rows]


@router.get('/reports/export')
async def export_report(request: Request, type_id: int = Query(ge=1, le=25), academic_year_id: int = Query(gt=0),
                        staff=Depends(require_staff), conn=Depends(connection)):
    eligible = [g for g in staff.grants if g['role_export'] and g['name'] != 'IQAC Member'
                and (flags := g['permissions'].get(str(type_id), {})).get('can_view') and flags.get('can_export')]
    if not eligible:
        raise HTTPException(403, 'Your role cannot export this record type.')
    output = StringIO(newline='')
    writer = csv.writer(output)
    fmt = ('id','academic_year','school','department','programme','status','proof','remarks','added_by','added_on','edited_by','edited_on')
    definition = TYPES[type_id]
    writer.writerow([*fmt,*definition['fields']])
    async with conn.transaction(isolation='repeatable_read'):
        rows = await conn.fetch(f'''SELECT r.*, y.label AS academic_year,s.name AS school,d.name AS department,p.name AS programme
            FROM records r JOIN academic_years y ON y.id=r.academic_year_id JOIN schools s ON s.id=r.school_id
            JOIN departments d ON d.id=r.department_id LEFT JOIN programmes p ON p.id=r.programme_id
            WHERE {sql_scope(1,2,'can_export')} AND r.type_id=$3 AND r.academic_year_id=$4 AND r.status='Verified'
            ORDER BY r.edited_on,r.id LIMIT 1001''', [dict(g) for g in eligible], staff.id, type_id, academic_year_id)
        if len(rows)>1000:
            raise HTTPException(422, 'This report exceeds 1,000 records. Export a narrower selection.')
        for row in rows:
            details = await record_details(conn, type_id, row['id'])
            can_export = list(grants_for(eligible, row, staff.id, 'can_export'))
            allowed = bool(next(grants_for(can_export, row, staff.id, 'can_see_restricted'), None))
            writer.writerow([*(csv_cell(row[key]) for key in fmt),
                *(csv_cell(details.get(c['key'])) if allowed or not c['restricted'] else '' for c in definition['columns'])])
        await audit(conn, request, 'Exported', staff, eligible[0]['role_id'], {'type_id': type_id, 'academic_year_id': academic_year_id},
                    new={'rows': len(rows), 'format': 'csv'})
    return Response('\ufeff'+output.getvalue(), media_type='text/csv', headers={
        'Content-Disposition': f'attachment; filename="{definition["table"]}-{academic_year_id}.csv"'})


@router.get('/audit')
async def audit_log(limit: int = Query(100, ge=1, le=250), offset: int = Query(0, ge=0),
                    staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN, PRINCIPAL)
    return [dict(row) for row in await conn.fetch('''SELECT id,at,user_id,role_id,action,type_id,record_reference,field_changed,
        status_before,status_after,reason,school_id,department_id,academic_year_id,host(ip_address) AS ip_address,
        device_or_browser,session_id FROM audit_log ORDER BY at DESC,id DESC LIMIT $1 OFFSET $2''',limit,offset)]
