from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import Field
from starlette.concurrency import run_in_threadpool

from .access import ADMIN, DEPARTMENT, INSTITUTE, OWN, PERMISSIONS, REVIEWER, SCHOOL, require_named
from .auth import hash_password, require_staff
from .db import audit, connection
from .fields import StrictBody, identifier

router = APIRouter(prefix='/api', tags=['Administration and master data'])
Text = Field(min_length=1, max_length=200)
Id = Field(gt=0)


class School(StrictBody):
    name: str = Text
    code: str = Field(min_length=1, max_length=30)
    dean_id: Optional[int] = Field(default=None, gt=0)
    established_year: Optional[int] = Field(default=None, ge=1000, le=9999)
    active: bool = True


class Department(StrictBody):
    name: str = Text
    code: str = Field(min_length=1, max_length=30)
    school_id: int = Id
    head_id: Optional[int] = Field(default=None, gt=0)
    established_year: Optional[int] = Field(default=None, ge=1000, le=9999)
    active: bool = True


class Programme(StrictBody):
    name: str = Text
    code: str = Field(min_length=1, max_length=30)
    department_id: int = Id
    level: Literal['UG','PG','PhD','Diploma']
    duration_years: Decimal = Field(gt=0, max_digits=4, decimal_places=1)
    status: Literal['Active','Discontinued','Proposed'] = 'Active'


class AcademicYear(StrictBody):
    label: str = Field(min_length=1, max_length=32)
    start_date: date
    end_date: date
    is_current: bool = False
    financial_year_label: str = Field(min_length=1, max_length=32)


class StaffData(StrictBody):
    employee_id: str = Field(min_length=1,max_length=80)
    title: Optional[str] = Field(default=None,max_length=40)
    first_name: str = Text
    middle_name: Optional[str] = Field(default=None,max_length=200)
    last_name: str = Text
    staff_type: Literal['Teaching','Non-teaching']
    designation: Optional[str] = Field(default=None,max_length=200)
    school_id: Optional[int] = Field(default=None,gt=0)
    department_id: Optional[int] = Field(default=None,gt=0)
    official_email: str = Field(max_length=254, pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
    phone: Optional[str] = Field(default=None,max_length=60)
    faculty_profile_id: Optional[UUID] = None
    account_status: Literal['Active','Inactive','Locked'] = 'Active'
    joining_date: Optional[date] = None
    leaving_date: Optional[date] = None


class NewStaff(StaffData):
    temporary_password: str = Field(min_length=12,max_length=128)


class TemporaryPassword(StrictBody):
    temporary_password: str = Field(min_length=12,max_length=128)


class RoleUpdate(StrictBody):
    description: Optional[str] = Field(default=None,max_length=500)
    can_verify: bool = False
    can_export: bool = False
    can_see_restricted: bool = False
    active: bool = True


class PermissionUpdate(StrictBody):
    can_view: bool = False
    can_add: bool = False
    can_edit_own: bool = False
    can_edit_any: bool = False
    can_delete: bool = False
    can_submit: bool = False
    can_verify: bool = False
    can_export: bool = False
    can_see_restricted: bool = False


class Assignment(StrictBody):
    user_id: int = Id
    role_id: int = Id
    school_id: Optional[int] = Field(default=None,gt=0)
    department_id: Optional[int] = Field(default=None,gt=0)
    type_ids: List[int] = Field(default_factory=list,max_length=25)
    valid_from: date
    valid_to: Optional[date] = None


MASTER = {'schools': School, 'departments': Department, 'programmes': Programme, 'academic_years': AcademicYear}
MasterKind = Literal['schools','departments','programmes','academic_years']
USER_COLUMNS = '''id,employee_id,title,first_name,middle_name,last_name,staff_type,designation,school_id,department_id,
    official_email,faculty_profile_id,account_status,joining_date,leaving_date,last_login,password_reset_required,
    added_by,added_on,edited_by,edited_on'''


async def store(conn, table, values, row_id=None):
    names = [identifier(key) for key in values]
    slots = [f'${index+1}' for index in range(len(names))]
    if row_id is None:
        return await conn.fetchval(f'INSERT INTO {identifier(table)} ({",".join(names)}) VALUES ({",".join(slots)}) RETURNING id',
                                   *values.values())
    pairs = ','.join(f'{n}={s}' for n,s in zip(names,slots))
    updated = await conn.fetchval(f'UPDATE {identifier(table)} SET {pairs} WHERE id=${len(names)+1} RETURNING id',
                                  *values.values(), row_id)
    if updated is None:
        raise HTTPException(404, 'The requested item does not exist.')
    return updated


@router.get('/directory')
async def directory(staff=Depends(require_staff), conn=Depends(connection)):
    async with conn.transaction(isolation='repeatable_read', readonly=True):
        schools = await conn.fetch('SELECT id,name,code FROM schools WHERE active ORDER BY name,id')
        departments = await conn.fetch('SELECT d.id,d.school_id,d.name,d.code FROM departments d JOIN schools s ON s.id=d.school_id WHERE d.active AND s.active ORDER BY d.name,d.id')
        programmes = await conn.fetch('SELECT id,department_id,name,code,status FROM programmes ORDER BY name,id')
        years = await conn.fetch('SELECT id,label,is_current FROM academic_years ORDER BY start_date DESC,id')
    return {name: [dict(row) for row in rows] for name, rows in (
        ('schools',schools), ('departments',departments), ('programmes',programmes), ('years',years))}


@router.get('/admin/master/{kind}')
async def master_list(kind: MasterKind, limit: int = Query(100, ge=1, le=250), offset: int = Query(0, ge=0),
                      staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN)
    return [dict(row) for row in await conn.fetch(f'SELECT * FROM {identifier(kind)} ORDER BY id LIMIT $1 OFFSET $2',limit,offset)]


async def save_master(kind, data, request, staff, conn, row_id=None):
    role = require_named(staff.grants, ADMIN)
    try:
        payload = MASTER[kind].model_validate(data)
    except ValueError as error:
        raise HTTPException(422, 'Master data contains missing or invalid fields.') from error
    async with conn.transaction():
        if isinstance(payload, AcademicYear) and payload.is_current:
            await conn.execute('SELECT pg_advisory_xact_lock(92720262)')
            await conn.execute('UPDATE academic_years SET is_current=false WHERE is_current AND ($1::bigint IS NULL OR id<>$1)',row_id)
        saved = await store(conn, kind, payload.model_dump(), row_id)
        await audit(conn, request, 'Edited' if row_id else 'Created', staff, role['role_id'], field=kind, new={'id': saved})
    return {'id': saved}


@router.post('/admin/master/{kind}', status_code=201)
async def add_master(kind: MasterKind, data: dict, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    return await save_master(kind,data,request,staff,conn)


@router.put('/admin/master/{kind}/{row_id}')
async def update_master(kind: MasterKind, row_id: int, data: dict, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    return await save_master(kind,data,request,staff,conn,row_id)


@router.get('/admin/staff')
async def list_staff(limit: int = Query(100, ge=1, le=250), offset: int = Query(0, ge=0),
                     staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN)
    return [dict(row) for row in await conn.fetch(f'SELECT {USER_COLUMNS} FROM users ORDER BY last_name,first_name,id LIMIT $1 OFFSET $2',limit,offset)]


@router.post('/admin/staff', status_code=201)
async def create_staff(data: NewStaff, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    role = require_named(staff.grants, ADMIN)
    password_hash = await run_in_threadpool(hash_password, data.temporary_password)
    values = data.model_dump(exclude={'temporary_password'})
    values['official_email'] = values['official_email'].lower()
    async with conn.transaction():
        user = await store(conn, 'users', values | {'added_by': staff.id,'edited_by': staff.id})
        await conn.execute('INSERT INTO staff_credentials(user_id,password_hash) VALUES($1,$2)',user,password_hash)
        await audit(conn,request,'Created',staff,role['role_id'],field='staff_account',new={'id':user})
    return {'id': user}


@router.put('/admin/staff/{user_id}')
async def update_staff(user_id: int, data: StaffData, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    role = require_named(staff.grants, ADMIN)
    if user_id==staff.id and (data.account_status!='Active' or data.leaving_date or data.joining_date and data.joining_date>date.today()):
        raise HTTPException(422,'You cannot disable your own administrative account.')
    values = data.model_dump()
    values['official_email'] = values['official_email'].lower()
    async with conn.transaction():
        await store(conn,'users', values | {'edited_by':staff.id},user_id)
        await conn.execute('UPDATE users SET edited_on=now() WHERE id=$1',user_id)
        await conn.execute('DELETE FROM staff_sessions WHERE user_id=$1 AND user_id<>$2',user_id,staff.id)
        await audit(conn,request,'Edited',staff,role['role_id'],field='staff_account',new={'id':user_id, 'status':data.account_status})
    return {'id': user_id}


@router.put('/admin/staff/{user_id}/password', status_code=204)
async def reset_password(user_id: int, data: TemporaryPassword, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    role = require_named(staff.grants, ADMIN)
    if user_id == staff.id:
        raise HTTPException(422,'Use your account password settings to change your own password.')
    password_hash = await run_in_threadpool(hash_password,data.temporary_password)
    async with conn.transaction():
        found = await conn.fetchval('UPDATE users SET password_reset_required=true,edited_by=$2,edited_on=now() WHERE id=$1 RETURNING id',user_id,staff.id)
        if found is None:
            raise HTTPException(404,'Staff account not found.')
        await conn.execute('''INSERT INTO staff_credentials(user_id,password_hash) VALUES($1,$2)
            ON CONFLICT(user_id) DO UPDATE SET password_hash=excluded.password_hash''',user_id,password_hash)
        await conn.execute('DELETE FROM staff_sessions WHERE user_id=$1',user_id)
        await audit(conn,request,'Edited',staff,role['role_id'],field='staff_password_reset',new={'id':user_id})
    return Response(status_code=204)


@router.get('/admin/roles')
async def roles(staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN)
    return [dict(row) for row in await conn.fetch('SELECT * FROM roles ORDER BY id')]


@router.put('/admin/roles/{role_id}')
async def edit_role(role_id: int, data: RoleUpdate, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    admin = require_named(staff.grants, ADMIN)
    if role_id == admin['role_id'] and (not data.active or data.can_see_restricted):
        raise HTTPException(422,'Super Admin must remain active and cannot be granted restricted field access.')
    async with conn.transaction():
        await store(conn,'roles',data.model_dump(),role_id)
        await audit(conn,request,'Role Changed',staff,admin['role_id'],field='role_settings',new={'id':role_id,**data.model_dump()})
    return {'id': role_id}


@router.get('/admin/roles/{role_id}/permissions')
async def permissions(role_id: int, staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN)
    return [dict(row) for row in await conn.fetch('SELECT * FROM role_permissions WHERE role_id=$1 ORDER BY type_id',role_id)]


@router.put('/admin/roles/{role_id}/permissions/{type_id}', status_code=204)
async def set_permissions(role_id: int, type_id: int, data: PermissionUpdate, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    admin = require_named(staff.grants, ADMIN)
    if not 1 <= type_id <= 25:
        raise HTTPException(422,'Unknown accreditation record type.')
    if role_id == admin['role_id'] and any(data.model_dump().values()):
        raise HTTPException(422,'Super Admin is an administrative role. Assign a separate role for record access.')
    columns = ','.join(PERMISSIONS)
    slots = ','.join(f'${i+3}' for i in range(len(PERMISSIONS)))
    setters = ','.join(f'{name}=excluded.{name}' for name in PERMISSIONS)
    async with conn.transaction():
        await conn.execute(f'''INSERT INTO role_permissions(role_id,type_id,{columns}) VALUES($1,$2,{slots})
            ON CONFLICT(role_id,type_id) DO UPDATE SET {setters}''',role_id,type_id,*(getattr(data,name) for name in PERMISSIONS))
        await audit(conn,request,'Role Changed',staff,admin['role_id'], {'type_id':type_id},
                    field='role_permissions',new={'role_id':role_id,**data.model_dump()})
    return Response(status_code=204)


@router.get('/admin/assignments')
async def assignments(user_id: int = Query(gt=0), staff=Depends(require_staff), conn=Depends(connection)):
    require_named(staff.grants, ADMIN)
    return [dict(row) for row in await conn.fetch('''SELECT a.*,r.name AS role_name,
        ARRAY(SELECT d.type_id FROM assignment_data_types d WHERE d.assignment_id=a.id ORDER BY d.type_id) AS type_ids
        FROM user_role_assignments a JOIN roles r ON r.id=a.role_id WHERE a.user_id=$1 ORDER BY a.id''',user_id)]


@router.post('/admin/assignments', status_code=201)
async def assign(data: Assignment, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    admin = require_named(staff.grants, ADMIN)
    if any(not 1 <= item <= 25 for item in data.type_ids) or data.valid_to and data.valid_to < data.valid_from:
        raise HTTPException(422,'Enter valid record types and assignment dates.')
    async with conn.transaction():
        role = await conn.fetchrow('SELECT name,level FROM roles WHERE id=$1 AND active',data.role_id)
        user = await conn.fetchrow('SELECT school_id,department_id FROM users WHERE id=$1',data.user_id)
        if not role or not user:
            raise HTTPException(422,'Choose an existing staff account and an active role.')
        school = data.school_id if role['level'] != OWN else data.school_id or user['school_id']
        department = data.department_id if role['level'] != OWN else data.department_id or user['department_id']
        valid = {INSTITUTE: school is None and department is None,
                 SCHOOL: school is not None and department is None,
                 DEPARTMENT: school is not None and department is not None,
                 OWN: school is not None and department is not None}[role['level']]
        if not valid or (role['name']==REVIEWER and data.valid_to is None) or (role['name']==ADMIN and data.type_ids):
            raise HTTPException(422,'The scope does not match this role, or a reviewer end date is missing.')
        assignment = await conn.fetchval('''INSERT INTO user_role_assignments(user_id,role_id,school_id,department_id,valid_from,valid_to,assigned_by)
            VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id''',data.user_id,data.role_id,school,department,data.valid_from,data.valid_to,staff.id)
        await conn.executemany('INSERT INTO assignment_data_types(assignment_id,type_id) VALUES($1,$2)',
                               [(assignment,type_id) for type_id in sorted(set(data.type_ids))])
        await audit(conn,request,'Role Changed',staff,admin['role_id'],field='assigned_role',new={'id':assignment,'role_id':data.role_id,'user_id':data.user_id})
    return {'id': assignment}


@router.delete('/admin/assignments/{assignment_id}', status_code=204)
async def revoke(assignment_id: int, request: Request, staff=Depends(require_staff), conn=Depends(connection)):
    admin = require_named(staff.grants, ADMIN)
    async with conn.transaction():
        row = await conn.fetchrow('SELECT user_id,role_id FROM user_role_assignments WHERE id=$1 FOR UPDATE',assignment_id)
        if not row:
            raise HTTPException(404,'Role assignment not found.')
        if row['user_id']==staff.id and row['role_id']==admin['role_id']:
            raise HTTPException(422,'You cannot revoke your own Super Admin assignment.')
        await conn.execute('DELETE FROM assignment_data_types WHERE assignment_id=$1',assignment_id)
        await conn.execute('DELETE FROM user_role_assignments WHERE id=$1',assignment_id)
        await audit(conn,request,'Role Changed',staff,admin['role_id'],field='revoked_role',old={'id':assignment_id,**dict(row)})
    return Response(status_code=204)
