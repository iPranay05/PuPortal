import asyncio
import getpass
import os

import asyncpg

from backend.admin import NewStaff
from backend.auth import hash_password
from backend.db import configure_connection


async def main():
    url = os.getenv('DATABASE_URL')
    if not url:
        raise SystemExit('A PostgreSQL connection is required before provisioning staff.')
    email = input('Official email: ').strip().lower()
    employee = input('Employee ID: ').strip()
    first = input('First name: ').strip()
    last = input('Last name: ').strip()
    password = getpass.getpass('Temporary password (minimum 12 characters): ')
    if password != getpass.getpass('Confirm temporary password: '):
        raise SystemExit('Passwords do not match.')
    try:
        NewStaff(employee_id=employee, first_name=first,last_name=last,official_email=email,
                 staff_type='Non-teaching', temporary_password=password)
    except ValueError:
        raise SystemExit('Check the staff details and password length.') from None
    conn = await asyncpg.connect(url, server_settings={'search_path':'accreditation,pg_catalog'})
    try:
        await configure_connection(conn)
        async with conn.transaction():
            await conn.execute('SELECT pg_advisory_xact_lock(92720261)')
            role = await conn.fetchval("SELECT id FROM roles WHERE name='Super Admin' AND active")
            if not role or await conn.fetchval('SELECT 1 FROM user_role_assignments WHERE role_id=$1 LIMIT 1',role):
                raise SystemExit('An administrator already exists or the accreditation schema is not ready.')
            user = await conn.fetchval('''INSERT INTO users(employee_id,first_name,last_name,official_email,staff_type,account_status)
                VALUES($1,$2,$3,$4,'Non-teaching','Active') RETURNING id''',employee,first,last,email)
            await conn.execute('INSERT INTO staff_credentials(user_id,password_hash) VALUES($1,$2)',user,hash_password(password))
            await conn.execute('''INSERT INTO user_role_assignments(user_id,role_id,valid_from,assigned_by)
                VALUES($1,$2,CURRENT_DATE,$1)''',user,role)
            await conn.execute("INSERT INTO audit_log(user_id,role_id,action,field_changed,new_value) VALUES($1,$2,'Role Changed','initial_administrator',$3)",
                               user,role,{'id':user})
        print('First administrator created. Change the temporary password on first sign-in.')
    finally:
        await conn.close()


if __name__ == '__main__':
    asyncio.run(main())
