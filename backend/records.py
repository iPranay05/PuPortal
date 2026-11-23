import base64
import binascii
from typing import Literal, Optional
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from .access import COORDINATOR, GRANTS, MEMBER, PRINCIPAL, grants_for, sql_scope
from .auth import ACTIVE, require_staff
from .db import TYPES, audit, audit_context, connection
from .fields import COMMON, FILE_TYPES, EvidenceBody, LinkRecord, NewRecord, Reason, RecordEdit, ReviewerAssignment, identifier, public_details, safe_proof, validate_details

router = APIRouter(prefix='/api/records', tags=['Accreditation records'])
STATES = Literal['Draft', 'Submitted', 'Verified']


async def get_record(conn, staff, record_id, lock=False):
    suffix = ' FOR UPDATE OF r' if lock else ''
    row = await conn.fetchrow('''SELECT r.*, EXISTS (SELECT 1 FROM record_reviewers rr WHERE rr.record_id=r.id AND rr.user_id=$2) AS assigned
        FROM records r WHERE r.id=$1''' + suffix, record_id, staff.id)
    if row is None or not next(grants_for(staff.grants, row, staff.id, 'can_view', row['assigned']), None):
        raise HTTPException(404, 'Record not found.')
    return row


def grant_for(staff, row, action):
    grant = next(grants_for(staff.grants, row, staff.id, action, row.get('assigned', False)), None)
    if grant is None:
        raise HTTPException(403, 'Your role cannot perform this action on the record.')
    return grant


def may_see_restricted(staff, row):
    return bool(next(grants_for(staff.grants, row, staff.id, 'can_see_restricted', row.get('assigned', False)), None))


def actions(staff, row):
    choices = {'Draft': {'edit': 'edit', 'delete': 'can_delete', 'submit': 'can_submit'},
               'Submitted': {'verify': 'can_verify', 'reject': 'can_verify'}, 'Verified': {}}
    result = [name for name, flag in choices[row['status']].items()
              if next(grants_for(staff.grants, row, staff.id, flag, row.get('assigned', False)), None)]
    if row['status'] != 'Verified' and any(g['name'] in (COORDINATOR, PRINCIPAL) for g in
        grants_for(staff.grants, row, staff.id, 'can_verify', row.get('assigned', False))):
        result.append('assign')
    return result


def header(staff, row):
    output = {key: row[key] for key in ('id', 'type_id', *COMMON, 'status', 'added_by', 'added_on', 'edited_by', 'edited_on')}
    output['type_name'] = TYPES[row['type_id']]['name']
    output['actions'] = actions(staff, row)
    return output


async def record_details(conn, type_id, record_id):
    table = identifier(TYPES[type_id]['table'])
    return await conn.fetchrow(f'SELECT * FROM {table} WHERE record_id=$1', record_id) or {}


async def write_details(conn, type_id, record_id, changes, create):
    table = identifier(TYPES[type_id]['table'])
    columns = [identifier(key) for key in changes]
    placeholders = [f'${index+2}' for index in range(len(columns))]
    if create:
        fields = ','.join(['record_id', *columns])
        values = ','.join(['$1', *placeholders])
        await conn.execute(f'INSERT INTO {table} ({fields}) VALUES ({values})', record_id, *changes.values())
    elif columns:
        update = ','.join(f'{col}={slot}' for col, slot in zip(columns, placeholders))
        await conn.execute(f'UPDATE {table} SET {update} WHERE record_id=$1', record_id, *changes.values())


async def validate_master(conn, row):
    valid = await conn.fetchval('''SELECT EXISTS (SELECT 1 FROM departments d JOIN schools s ON s.id=d.school_id
        JOIN academic_years y ON y.id=$1 WHERE s.active AND d.active AND d.id=$2 AND s.id=$3
          AND ($4::bigint IS NULL OR EXISTS (SELECT 1 FROM programmes p WHERE p.id=$4 AND p.department_id=d.id)))''',
        row['academic_year_id'], row['department_id'], row['school_id'], row['programme_id'])
    if not valid:
        raise HTTPException(422, 'Choose a valid academic year, active school and department, and a programme from that department.')


@router.get('')
async def list_records(type_id: Optional[int] = Query(None, ge=1, le=25), academic_year_id: Optional[int] = Query(None, gt=0),
                       status: Optional[STATES] = None, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                       staff=Depends(require_staff), conn=Depends(connection)):
    rows = await conn.fetch(f'''SELECT r.*, s.name AS school, d.name AS department, y.label AS academic_year,
        EXISTS (SELECT 1 FROM record_reviewers rr WHERE rr.record_id=r.id AND rr.user_id=$2) AS assigned
        FROM records r JOIN schools s ON s.id=r.school_id JOIN departments d ON d.id=r.department_id
        JOIN academic_years y ON y.id=r.academic_year_id
        WHERE {sql_scope(1,2)} AND ($3::smallint IS NULL OR r.type_id=$3) AND ($4::bigint IS NULL OR r.academic_year_id=$4)
          AND ($5::record_status IS NULL OR r.status=$5) ORDER BY r.edited_on DESC,r.id DESC LIMIT $6 OFFSET $7''',
        [dict(g) for g in staff.grants], staff.id, type_id, academic_year_id, status, limit+1, offset)
    return {'items': [{**header(staff, r), 'school': r['school'], 'department': r['department'], 'academic_year': r['academic_year']}
                      for r in rows[:limit]], 'has_more': len(rows)>limit}


@router.post('', status_code=201)
async def create_record(data: NewRecord, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    row = data.model_dump(exclude={'details'}) | {'added_by': staff.id, 'status': 'Draft'}
    row['proof'] = safe_proof(row['proof'])
    grant = grant_for(staff, row, 'can_add')
    changes = validate_details(data.type_id, data.details, may_see_restricted(staff, row), creating=True)
    async with conn.transaction():
        await validate_master(conn, row)
        await audit_context(conn, request, staff, grant['role_id'])
        result = await conn.fetchrow('''INSERT INTO records(type_id, academic_year_id, school_id, department_id, programme_id,
            proof, remarks, added_by, edited_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *''',
            row['type_id'], *(row[key] for key in COMMON), staff.id)
        await write_details(conn, data.type_id, result['id'], changes, True)
        if changes:
            await audit(conn, request, 'Created', staff, grant['role_id'], result, field='details', new=changes)
    return header(staff, result)


@router.get('/{record_id}')
async def read_record(record_id: UUID, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction(isolation='repeatable_read'):
        row = await get_record(conn, staff, record_id)
        role = grant_for(staff, row, 'can_view')
        details = await record_details(conn, row['type_id'], record_id)
        evidence = await conn.fetchrow('SELECT filename, content_type FROM record_evidence WHERE record_id=$1', record_id)
        links = await conn.fetch(f'''SELECT r.id,r.type_id,l.relationship FROM record_links l JOIN records r ON r.id=l.target_id
            WHERE l.source_id=$3 AND {sql_scope(1,2)} ORDER BY r.type_id,r.id,l.relationship LIMIT 100''',
            [dict(g) for g in staff.grants], staff.id, record_id)
        await audit(conn, request, 'Viewed', staff, role['role_id'], row)
    return {**header(staff, row), 'details': public_details(row['type_id'], details, may_see_restricted(staff,row)),
            'evidence': dict(evidence) if evidence else None, 'links': [dict(link) for link in links],
            'can_see_restricted': may_see_restricted(staff,row)}


@router.patch('/{record_id}')
async def edit_record(record_id: UUID, data: RecordEdit, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction():
        row = await get_record(conn, staff, record_id, True)
        role = grant_for(staff, row, 'edit')
        if row['status'] != 'Draft':
            raise HTTPException(409, 'Only drafts can be edited.')
        common = data.model_dump(exclude_unset=True, exclude={'details'})
        if 'proof' in common:
            common['proof'] = safe_proof(common['proof'])
        updated = dict(row) | common
        if any(updated[key] is None for key in COMMON[:3]):
            raise HTTPException(422, 'Academic year, school and department are required.')
        if not list(grants_for([role], updated, staff.id, 'edit', row['assigned'])):
            raise HTTPException(403, 'Records cannot move outside your scope.')
        changes = validate_details(row['type_id'], data.details, may_see_restricted(staff,row) and may_see_restricted(staff,updated))
        if not (common or changes):
            return header(staff, row)
        await validate_master(conn, updated)
        old = await record_details(conn, row['type_id'], record_id) if changes else {}
        await audit_context(conn, request, staff, role['role_id'])
        result = await conn.fetchrow('''UPDATE records SET academic_year_id=$2, school_id=$3, department_id=$4,
            programme_id=$5, proof=$6, remarks=$7, edited_by=$8 WHERE id=$1 RETURNING *''',
            record_id, *(updated[key] for key in COMMON), staff.id)
        await write_details(conn, row['type_id'], record_id, changes, False)
        for key, value in changes.items():
            if old.get(key) != value:
                await audit(conn, request, 'Edited', staff, role['role_id'], result, field=key, old=old.get(key), new=value)
    return header(staff, result)


async def transition(conn, request, staff, record_id, before, after, permission, reason=None):
    async with conn.transaction():
        row = await get_record(conn, staff, record_id, True)
        role = grant_for(staff, row, permission)
        if row['status'] != before:
            raise HTTPException(409, f'This action requires a {before.lower()} record.')
        if after == 'Submitted':
            await validate_master(conn, row)
        await audit_context(conn, request, staff, role['role_id'], reason)
        result = await conn.fetchrow('UPDATE records SET status=$2, edited_by=$3 WHERE id=$1 RETURNING *', record_id, after, staff.id)
    return header(staff, dict(result) | {'assigned': row['assigned']})


@router.post('/{record_id}/submit')
async def submit(record_id: UUID, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    return await transition(conn, request, staff, record_id, 'Draft', 'Submitted', 'can_submit')


@router.post('/{record_id}/verify')
async def verify(record_id: UUID, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    return await transition(conn, request, staff, record_id, 'Submitted', 'Verified', 'can_verify')


@router.post('/{record_id}/reject')
async def reject(record_id: UUID, data: Reason, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    return await transition(conn, request, staff, record_id, 'Submitted', 'Draft', 'can_verify', data.reason)


@router.delete('/{record_id}', status_code=204)
async def delete(record_id: UUID, data: Reason, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction():
        row = await get_record(conn, staff, record_id, True)
        role = grant_for(staff, row, 'can_delete')
        if row['status'] != 'Draft':
            raise HTTPException(409, 'Only drafts can be deleted.')
        await audit_context(conn, request, staff, role['role_id'], data.reason)
        await conn.execute('DELETE FROM records WHERE id=$1', record_id)
    return Response(status_code=204)


@router.put('/{record_id}/reviewers', status_code=204)
async def assign_reviewer(record_id: UUID, data: ReviewerAssignment, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction():
        row = await get_record(conn, staff, record_id, True)
        role = next((g for g in grants_for(staff.grants, row, staff.id, 'can_verify', row['assigned'])
                     if g['name'] in (PRINCIPAL, COORDINATOR)), None)
        if role is None:
            raise HTTPException(403, 'Only the principal or an IQAC coordinator may assign reviewers.')
        if row['status'] == 'Verified':
            raise HTTPException(409, 'Verified records are closed.')
        active = await conn.fetchval(f'SELECT u.id FROM users u WHERE u.id=$1 AND {ACTIVE}', data.user_id)
        if not active or not next(grants_for([g for g in await conn.fetch(GRANTS, data.user_id) if g['name']==MEMBER],
                                              row, data.user_id, 'can_verify', True), None):
            raise HTTPException(422, 'Choose an active IQAC member who can verify this record type.')
        added = await conn.fetchval('INSERT INTO record_reviewers(record_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING user_id',
                                    record_id, data.user_id)
        if added:
            await audit(conn, request, 'Role Changed', staff, role['role_id'], row, field='reviewer_assigned', new=added)
    return Response(status_code=204)


@router.post('/{record_id}/links', status_code=204)
async def link_record(record_id: UUID, data: LinkRecord, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    if record_id == data.target_id:
        raise HTTPException(422, 'A record cannot link to itself.')
    async with conn.transaction():
        source = await get_record(conn, staff, record_id, True)
        role = grant_for(staff, source, 'edit')
        if source['status'] != 'Draft':
            raise HTTPException(409, 'Links can only be added to drafts.')
        await get_record(conn, staff, data.target_id)
        linked = await conn.fetchval('''INSERT INTO record_links(source_id,target_id,relationship) VALUES ($1,$2,$3)
            ON CONFLICT DO NOTHING RETURNING target_id''', record_id, data.target_id, data.relationship)
        if linked:
            await audit_context(conn, request, staff, role['role_id'])
            await conn.execute('UPDATE records SET edited_by=$2 WHERE id=$1', record_id, staff.id)
            await audit(conn, request, 'Edited', staff, role['role_id'], source, field='record_link', new={'target': linked, 'label': data.relationship})
    return Response(status_code=204)


@router.put('/{record_id}/evidence', status_code=204)
async def save_evidence(record_id: UUID, data: EvidenceBody, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    if data.content_type not in FILE_TYPES or '/' in data.filename or '\\' in data.filename or any(ord(c)<32 for c in data.filename):
        raise HTTPException(422, 'Use a PDF, PNG, JPEG or plain-text evidence file with a valid filename.')
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(422, 'The evidence file is not valid base64.')
    if not 1 <= len(content) <= 3145728:
        raise HTTPException(422, 'Evidence must be between 1 byte and 3 MB.')
    async with conn.transaction():
        row = await get_record(conn, staff, record_id, True)
        role = grant_for(staff, row, 'edit')
        if row['status'] != 'Draft':
            raise HTTPException(409, 'Evidence can only be edited on drafts.')
        await audit_context(conn, request, staff, role['role_id'])
        await conn.execute('UPDATE records SET edited_by=$2 WHERE id=$1', record_id, staff.id)
        await conn.execute('''INSERT INTO record_evidence(record_id,filename,content_type,content) VALUES ($1,$2,$3,$4)
            ON CONFLICT(record_id) DO UPDATE SET filename=excluded.filename,content_type=excluded.content_type,content=excluded.content''',
            record_id, data.filename, data.content_type, content)
        await audit(conn, request, 'Edited', staff, role['role_id'], row, field='evidence', new=data.filename)
    return Response(status_code=204)


@router.get('/{record_id}/evidence')
async def download_evidence(record_id: UUID, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction(isolation='repeatable_read'):
        row = await get_record(conn, staff, record_id)
        role = grant_for(staff, row, 'can_view')
        evidence = await conn.fetchrow('SELECT filename,content FROM record_evidence WHERE record_id=$1', record_id)
        if not evidence:
            raise HTTPException(404, 'This record has no uploaded evidence.')
        await audit(conn, request, 'Viewed', staff, role['role_id'], row, field='evidence')
    return Response(evidence['content'], media_type='application/octet-stream', headers={
        'Content-Disposition': "attachment; filename*=UTF-8''"+quote(evidence['filename'], safe=''),
        'X-Content-Type-Options': 'nosniff',
    })
