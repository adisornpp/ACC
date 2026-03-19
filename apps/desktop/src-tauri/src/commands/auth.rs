use crate::db::DbState;
use crate::models::{LoginInput, User};
use tauri::State;
use uuid::Uuid;
use bcrypt::{hash, verify, DEFAULT_COST};

#[tauri::command]
pub fn login(db: State<DbState>, email: String, password: String, company_id: String) -> Result<User, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let result = conn.query_row(
        "SELECT id, company_id, email, password_hash, full_name, role, is_active, created_at, updated_at
         FROM users WHERE email = ?1 AND company_id = ?2 AND is_active = 1",
        rusqlite::params![email, company_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, i32>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
            ))
        },
    );

    match result {
        Ok((id, company_id, user_email, password_hash, full_name, role, is_active, created_at, updated_at)) => {
            let valid = verify(&password, &password_hash).map_err(|e| e.to_string())?;
            if !valid {
                return Err("อีเมลหรือรหัสผ่านไม่ถูกต้อง".into());
            }

            // Save session
            let session_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT OR REPLACE INTO sessions (id, user_id, company_id, expires_at)
                 VALUES (?1, ?2, ?3, datetime('now', '+8 hours'))",
                rusqlite::params![session_id, id, company_id],
            ).map_err(|e| e.to_string())?;

            Ok(User {
                id,
                company_id,
                email: user_email,
                full_name,
                role,
                is_active: is_active != 0,
                created_at,
                updated_at,
            })
        }
        Err(_) => Err("อีเมลหรือรหัสผ่านไม่ถูกต้อง".into()),
    }
}

#[tauri::command]
pub fn logout(db: State<DbState>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Clean up expired sessions
    conn.execute(
        "DELETE FROM sessions WHERE expires_at < datetime('now')",
        [],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_current_user(db: State<DbState>) -> Result<Option<User>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT u.id, u.company_id, u.email, u.full_name, u.role, u.is_active, u.created_at, u.updated_at
         FROM users u
         JOIN sessions s ON s.user_id = u.id
         WHERE s.expires_at > datetime('now')
         ORDER BY s.created_at DESC LIMIT 1",
        [],
        |row| {
            Ok(User {
                id: row.get(0)?,
                company_id: row.get(1)?,
                email: row.get(2)?,
                full_name: row.get(3)?,
                role: row.get(4)?,
                is_active: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    );
    match result {
        Ok(user) => Ok(Some(user)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_admin_user(
    db: State<DbState>,
    company_id: String,
    email: String,
    password: String,
    full_name: String,
) -> Result<User, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let password_hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO users (id, company_id, email, password_hash, full_name, role)
         VALUES (?1, ?2, ?3, ?4, ?5, 'admin')",
        rusqlite::params![id, company_id, email, password_hash, full_name],
    ).map_err(|e| e.to_string())?;

    Ok(User {
        id,
        company_id,
        email,
        full_name,
        role: "admin".into(),
        is_active: true,
        created_at: String::new(),
        updated_at: String::new(),
    })
}
