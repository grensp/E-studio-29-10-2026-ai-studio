use crate::db::{AuditRecord, TemplateSummary, UpsertRejection, UpsertResult};
use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::State;

pub struct DbState(pub Mutex<Connection>, pub std::path::PathBuf);

static AUDIT_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Helper: Safely converts a JSON String or Number into a trimmed String
fn value_to_str(val: Option<&Value>) -> Option<String> {
    match val {
        Some(Value::String(s)) => {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Some(Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
}

#[tauri::command]
pub fn template_list(state: State<'_, DbState>) -> Result<Vec<TemplateSummary>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, revision, document_json, updated_at FROM templates ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let revision: i64 = row.get(2)?;
            let doc_json: String = row.get(3)?;
            let updated_at: String = row.get(4)?;

            let doc: Value = serde_json::from_str(&doc_json).unwrap_or(Value::Null);
            let width_mm = doc["width_mm"].as_f64().unwrap_or(100.0);
            let height_mm = doc["height_mm"].as_f64().unwrap_or(50.0);

            Ok(TemplateSummary {
                id,
                name,
                width_mm,
                height_mm,
                revision,
                updated_at,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn template_get(state: State<'_, DbState>, id: String) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT document_json FROM templates WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let doc_str: Option<String> = stmt
        .query_row(params![id], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;

    match doc_str {
        Some(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        None => Err(format!("Template with id '{}' not found", id)),
    }
}

#[tauri::command]
pub fn template_get_revision(
    state: State<'_, DbState>,
    id: String,
    revision: i64,
) -> Result<Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT document_json FROM template_revisions WHERE id = ?1 AND revision = ?2")
        .map_err(|e| e.to_string())?;

    let doc_str: Option<String> = stmt
        .query_row(params![id, revision], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;

    match doc_str {
        Some(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
        None => {
            // Fallback to active template if specific revision is not recorded
            let mut stmt2 = conn
                .prepare("SELECT document_json FROM templates WHERE id = ?1")
                .map_err(|e| e.to_string())?;
            let fallback: Option<String> = stmt2
                .query_row(params![id], |row| row.get(0))
                .optional()
                .map_err(|e| e.to_string())?;
            match fallback {
                Some(s) => serde_json::from_str(&s).map_err(|e| e.to_string()),
                None => Err(format!("Gabarit '{}' (révision {}) introuvable", id, revision)),
            }
        }
    }
}

#[tauri::command]
pub fn template_save(state: State<'_, DbState>, mut doc: Value) -> Result<Value, String> {
    let obj = doc
        .as_object_mut()
        .ok_or_else(|| "Template must be a valid JSON object".to_string())?;

    let name = obj
        .get("name")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .unwrap_or_default();

    if name.is_empty() {
        return Err("Le nom du gabarit ne peut pas être vide".to_string());
    }

    let width_mm = obj
        .get("width_mm")
        .and_then(|v| v.as_f64())
        .ok_or_else(|| "La largeur (width_mm) doit être un nombre valide".to_string())?;

    let height_mm = obj
        .get("height_mm")
        .and_then(|v| v.as_f64())
        .ok_or_else(|| "La hauteur (height_mm) doit être un nombre valide".to_string())?;

    if !width_mm.is_finite() || width_mm <= 0.0 || width_mm > 2000.0 {
        return Err("La largeur (width_mm) doit être comprise entre 0 et 2000 mm".to_string());
    }

    if !height_mm.is_finite() || height_mm <= 0.0 || height_mm > 2000.0 {
        return Err("La hauteur (height_mm) doit être comprise entre 0 et 2000 mm".to_string());
    }

    let items = obj
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Le gabarit doit contenir un tableau 'items'".to_string())?;

    for it in items {
        if !it.is_object() {
            return Err("Chaque élément dans 'items' doit être un objet JSON valide".to_string());
        }
    }

    let schema_version = obj
        .get("schema_version")
        .and_then(|v| v.as_i64())
        .unwrap_or(1);
    obj.insert("schema_version".to_string(), Value::Number(schema_version.into()));

    let id = obj
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("tpl_{}", Utc::now().timestamp_millis()));

    obj.insert("id".to_string(), Value::String(id.clone()));
    obj.insert("name".to_string(), Value::String(name.clone()));

    let now = Utc::now().to_rfc3339();
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let existing_revision: Option<i64> = tx
        .query_row(
            "SELECT revision FROM templates WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let revision: i64 = match existing_revision {
        Some(rev) => rev + 1,
        None => 1,
    };

    let created_at = obj
        .get("created_at")
        .and_then(|v| v.as_str())
        .unwrap_or(&now)
        .to_string();

    obj.insert("revision".to_string(), Value::Number(revision.into()));
    obj.insert("created_at".to_string(), Value::String(created_at.clone()));
    obj.insert("updated_at".to_string(), Value::String(now.clone()));

    let doc_str = serde_json::to_string(&doc).map_err(|e| e.to_string())?;

    // Upsert into head templates table
    tx.execute(
        "INSERT INTO templates (id, name, revision, document_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            revision = excluded.revision,
            document_json = excluded.document_json,
            updated_at = excluded.updated_at",
        params![id, name, revision, doc_str, created_at, now],
    )
    .map_err(|e| e.to_string())?;

    // Append to immutable revision history
    tx.execute(
        "INSERT INTO template_revisions (id, revision, document_json, saved_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, revision, doc_str, now],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(doc)
}

#[tauri::command]
pub fn template_delete(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM templates WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn catalog_search(
    state: State<'_, DbState>,
    q: String,
    limit: Option<usize>,
) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let trimmed = q.trim();
    let max_rows = limit.unwrap_or(if trimmed.is_empty() { 50000 } else { 250 });
    let like_query = format!("%{}%", trimmed);
    let mut stmt = conn
        .prepare(
            "SELECT document_json FROM products
             WHERE (?1 = '%%'
                OR scan LIKE ?1
                OR partno LIKE ?1
                OR json_extract(document_json, '$.ITEMNAME') LIKE ?1
                OR json_extract(document_json, '$.DESIGNATION') LIKE ?1
                OR json_extract(document_json, '$.PRODUCT_NAME') LIKE ?1)
             ORDER BY id ASC LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![like_query, max_rows], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for r in rows {
        let json_str = r.map_err(|e| e.to_string())?;
        if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
            results.push(val);
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn catalog_upsert(state: State<'_, DbState>, rows: Vec<Value>) -> Result<UpsertResult, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut inserted = 0;
    let mut updated = 0;
    let mut rejected = 0;
    let mut rejections = Vec::new();

    for (idx, row) in rows.into_iter().enumerate() {
        let obj = match row.as_object() {
            Some(o) => o,
            None => {
                rejected += 1;
                rejections.push(UpsertRejection { index: idx, reason: "not_an_object".to_string() });
                continue;
            }
        };

        let id = value_to_str(obj.get("id"))
            .or_else(|| value_to_str(obj.get("PARTNO")))
            .or_else(|| value_to_str(obj.get("PRODUCT_SCAN")));

        let id = match id {
            Some(s) if !s.trim().is_empty() => s.trim().to_string(),
            _ => {
                rejected += 1;
                rejections.push(UpsertRejection { index: idx, reason: "missing_id".to_string() });
                continue;
            }
        };

        // Check SELLING_PRICE validity if present
        if let Some(price_val) = obj.get("SELLING_PRICE") {
            if !price_val.is_null() {
                let is_valid = match price_val {
                    Value::Number(n) => n.as_f64().map_or(false, |f| f.is_finite()),
                    Value::String(s) => {
                        let trimmed = s.trim();
                        if trimmed.is_empty() {
                            true
                        } else {
                            let clean = trimmed.replace('€', "").replace('$', "").replace("FCFA", "").replace(' ', "").replace(',', ".");
                            clean.parse::<f64>().map_or(false, |f| f.is_finite())
                        }
                    }
                    _ => false,
                };
                if !is_valid {
                    rejected += 1;
                    rejections.push(UpsertRejection { index: idx, reason: "invalid_price".to_string() });
                    continue;
                }
            }
        }

        let scan = value_to_str(obj.get("PRODUCT_SCAN"))
            .or_else(|| value_to_str(obj.get("scan")))
            .or_else(|| value_to_str(obj.get("barcode")));

        let partno = value_to_str(obj.get("PARTNO"))
            .or_else(|| value_to_str(obj.get("partno")));

        let doc_json = match serde_json::to_string(&row) {
            Ok(s) => s,
            Err(_) => {
                rejected += 1;
                rejections.push(UpsertRejection { index: idx, reason: "not_an_object".to_string() });
                continue;
            }
        };

        let exists: bool = tx
            .query_row(
                "SELECT 1 FROM products WHERE id = ?1",
                params![id],
                |_| Ok(true),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or(false);

        if exists {
            tx.execute(
                "UPDATE products SET scan = ?2, partno = ?3, document_json = ?4 WHERE id = ?1",
                params![id, scan, partno, doc_json],
            )
            .map_err(|e| e.to_string())?;
            updated += 1;
        } else {
            tx.execute(
                "INSERT INTO products (id, scan, partno, document_json) VALUES (?1, ?2, ?3, ?4)",
                params![id, scan, partno, doc_json],
            )
            .map_err(|e| e.to_string())?;
            inserted += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;

    Ok(UpsertResult {
        inserted,
        updated,
        rejected,
        rejections,
    })
}

#[tauri::command]
pub fn catalog_replace_all(state: State<'_, DbState>, rows: Vec<Value>) -> Result<usize, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM products", [])
        .map_err(|e| e.to_string())?;

    let mut count = 0;
    for row in rows {
        let obj = match row.as_object() {
            Some(o) => o,
            None => continue,
        };

        let id = value_to_str(obj.get("id"))
            .or_else(|| value_to_str(obj.get("PARTNO")))
            .or_else(|| value_to_str(obj.get("PRODUCT_SCAN")))
            .unwrap_or_default()
            .trim()
            .to_string();

        if id.is_empty() {
            continue;
        }

        let scan = value_to_str(obj.get("PRODUCT_SCAN"))
            .or_else(|| value_to_str(obj.get("scan")))
            .or_else(|| value_to_str(obj.get("barcode")));

        let partno = value_to_str(obj.get("PARTNO"))
            .or_else(|| value_to_str(obj.get("partno")));

        if let Ok(doc_json) = serde_json::to_string(&row) {
            tx.execute(
                "INSERT INTO products (id, scan, partno, document_json) VALUES (?1, ?2, ?3, ?4)",
                params![id, scan, partno, doc_json],
            )
            .map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn catalog_commit_import(
    state: State<'_, DbState>,
    rows: Vec<Value>,
    report_json: String,
    replace_all: bool,
) -> Result<usize, String> {
    let report: Value = serde_json::from_str(&report_json)
        .map_err(|e| format!("Import report is invalid JSON: {e}"))?;
    let batch_id = report.get("id").and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| "Import report must contain an id".to_string())?;
    let filename = report.get("filename").and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
        .ok_or_else(|| "Import report must contain a filename".to_string())?;
    let created_at = report.get("timestamp").and_then(Value::as_str)
        .unwrap_or(&Utc::now().to_rfc3339())
        .to_string();

    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    if replace_all {
        tx.execute("DELETE FROM products", []).map_err(|e| e.to_string())?;
    }

    let mut count = 0;
    for row in rows {
        let obj = row.as_object()
            .ok_or_else(|| "Catalog import contains a non-object product".to_string())?;
        let id = value_to_str(obj.get("id"))
            .or_else(|| value_to_str(obj.get("PARTNO")))
            .or_else(|| value_to_str(obj.get("PRODUCT_SCAN")))
            .ok_or_else(|| "Catalog import contains a product without an identifier".to_string())?;
        let scan = value_to_str(obj.get("PRODUCT_SCAN"))
            .or_else(|| value_to_str(obj.get("scan")))
            .or_else(|| value_to_str(obj.get("barcode")));
        let partno = value_to_str(obj.get("PARTNO"))
            .or_else(|| value_to_str(obj.get("partno")));
        let document_json = serde_json::to_string(&row).map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO products (id, scan, partno, document_json) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET scan = excluded.scan, partno = excluded.partno, document_json = excluded.document_json",
            params![id, scan, partno, document_json],
        ).map_err(|e| e.to_string())?;
        count += 1;
    }

    tx.execute(
        "INSERT OR REPLACE INTO import_batches (id, filename, report_json, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![batch_id, filename, report_json, created_at],
    ).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}

#[tauri::command]
pub fn job_insert(state: State<'_, DbState>, job: Value) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = job
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Print job must contain an id".to_string())?;

    let created_at = job
        .get("created_at")
        .and_then(|v| v.as_str())
        .unwrap_or(&Utc::now().to_rfc3339())
        .to_string();

    let job_json = serde_json::to_string(&job).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO print_jobs (id, job_json, created_at) VALUES (?1, ?2, ?3)",
        params![id, job_json, created_at],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn job_list(state: State<'_, DbState>, limit: Option<usize>) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT job_json FROM print_jobs ORDER BY created_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit.unwrap_or(100)], |row| {
            let json_str: String = row.get(0)?;
            Ok(json_str)
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        let json_str = r.map_err(|e| e.to_string())?;
        if let Ok(val) = serde_json::from_str::<Value>(&json_str) {
            list.push(val);
        }
    }
    Ok(list)
}

#[tauri::command]
pub fn audit_append(
    state: State<'_, DbState>,
    action: String,
    entity_id: Option<String>,
    details: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    // OS user strictly determined from Rust OS runtime, never trusted from the WebView
    let os_user = whoami::fallible::username().unwrap_or_else(|_| "os_user".to_string());
    let counter = AUDIT_COUNTER.fetch_add(1, Ordering::Relaxed);
    let id = format!("aud_{}_{}", Utc::now().timestamp_millis(), counter);
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO audit (id, at, os_user, action, entity_id, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, now, os_user, action, entity_id, details],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn audit_list(state: State<'_, DbState>, limit: Option<usize>) -> Result<Vec<AuditRecord>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(200);
    let mut stmt = conn
        .prepare("SELECT id, at, os_user, action, entity_id, details FROM audit ORDER BY at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![lim], |row| {
            Ok(AuditRecord {
                id: row.get(0)?,
                at: row.get(1)?,
                os_user: row.get(2)?,
                action: row.get(3)?,
                entity_id: row.get(4)?,
                details: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn prefs_get(state: State<'_, DbState>, key: String) -> Result<Option<String>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM kv WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let val: Option<String> = stmt
        .query_row(params![key], |row| row.get(0))
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(val)
}

#[tauri::command]
pub fn prefs_set(state: State<'_, DbState>, key: String, value: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn prefs_list(state: State<'_, DbState>) -> Result<Vec<(String, String)>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT key, value FROM kv ORDER BY key ASC").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?))).map_err(|e| e.to_string())?;
    let mut values = Vec::new();
    for row in rows {
        values.push(row.map_err(|e| e.to_string())?);
    }
    Ok(values)
}

#[tauri::command]
pub fn batch_import_record(
    state: State<'_, DbState>,
    id: String,
    filename: String,
    report_json: String,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO import_batches (id, filename, report_json, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, filename, report_json, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn batch_import_list(state: State<'_, DbState>, limit: Option<usize>) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, filename, report_json, created_at FROM import_batches ORDER BY created_at DESC LIMIT ?1")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit.unwrap_or(100)], |row| {
            let id: String = row.get(0)?;
            let filename: String = row.get(1)?;
            let report_json: String = row.get(2)?;
            let created_at: String = row.get(3)?;
            let mut report_val: Value = serde_json::from_str(&report_json).unwrap_or(Value::Null);
            if let Some(obj) = report_val.as_object_mut() {
                obj.insert("id".to_string(), Value::String(id));
                obj.insert("filename".to_string(), Value::String(filename));
                obj.insert("timestamp".to_string(), Value::String(created_at));
            }
            Ok(report_val)
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r.map_err(|e| e.to_string())?);
    }
    Ok(list)
}

#[tauri::command]
pub fn database_restore(state: State<'_, DbState>, backup: Value) -> Result<Value, String> {
    if backup.get("version").and_then(Value::as_i64) != Some(1) {
        return Err("Unsupported database backup version".to_string());
    }

    let templates = backup.get("templates").and_then(Value::as_array)
        .ok_or_else(|| "Backup templates must be an array".to_string())?;
    let products = backup.get("products").and_then(Value::as_array)
        .ok_or_else(|| "Backup products must be an array".to_string())?;
    let jobs = backup.get("jobs").and_then(Value::as_array)
        .ok_or_else(|| "Backup jobs must be an array".to_string())?;
    let audit = backup.get("audit").and_then(Value::as_array)
        .ok_or_else(|| "Backup audit must be an array".to_string())?;
    let batches = backup.get("import_batches").and_then(Value::as_array)
        .ok_or_else(|| "Backup import_batches must be an array".to_string())?;
    let preferences = backup.get("preferences").and_then(Value::as_object)
        .ok_or_else(|| "Backup preferences must be an object".to_string())?;
    if preferences.values().any(|value| !value.is_string()) {
        return Err("Backup preferences must contain string values".to_string());
    }

    for template in templates {
        let obj = template.as_object().ok_or_else(|| "Each template must be an object".to_string())?;
        let id = value_to_str(obj.get("id")).ok_or_else(|| "Each template must have an id".to_string())?;
        let name = value_to_str(obj.get("name")).ok_or_else(|| format!("Template '{}' must have a name", id))?;
        let width = obj.get("width_mm").and_then(Value::as_f64).ok_or_else(|| format!("Template '{}' has invalid width_mm", id))?;
        let height = obj.get("height_mm").and_then(Value::as_f64).ok_or_else(|| format!("Template '{}' has invalid height_mm", id))?;
        if name.is_empty() || !width.is_finite() || !height.is_finite() || width <= 0.0 || height <= 0.0 || width > 2000.0 || height > 2000.0 {
            return Err(format!("Template '{}' failed validation", id));
        }
        if !obj.get("items").map_or(false, Value::is_array) {
            return Err(format!("Template '{}' items must be an array", id));
        }
    }

    for product in products {
        let obj = product.as_object().ok_or_else(|| "Each product must be an object".to_string())?;
        if value_to_str(obj.get("id")).or_else(|| value_to_str(obj.get("PARTNO"))).or_else(|| value_to_str(obj.get("PRODUCT_SCAN"))).is_none() {
            return Err("Each product must have an id, PARTNO, or PRODUCT_SCAN".to_string());
        }
        for field in ["SELLING_PRICE", "PROMOPRICE"] {
            if let Some(price) = obj.get(field) {
                if !price.is_null() {
                    let valid = match price {
                        Value::Number(number) => number.as_f64().map_or(false, f64::is_finite),
                        Value::String(raw) if raw.trim().is_empty() => true,
                        Value::String(raw) => {
                            let normalized = raw.trim().replace('€', "").replace('$', "").replace("FCFA", "").replace(' ', "").replace(',', ".");
                            normalized.parse::<f64>().map_or(false, f64::is_finite)
                        }
                        _ => false,
                    };
                    if !valid {
                        return Err(format!("Backup contains an invalid {}", field));
                    }
                }
            }
        }
    }

    for (collection, rows) in [("jobs", jobs), ("audit", audit), ("import_batches", batches)] {
        for row in rows {
            let obj = row.as_object().ok_or_else(|| format!("Each {} entry must be an object", collection))?;
            if value_to_str(obj.get("id")).is_none() {
                return Err(format!("Each {} entry must have an id", collection));
            }
        }
    }

    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM templates", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM template_revisions", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM products", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM print_jobs", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM audit", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM import_batches", []).map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM kv", []).map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    for template in templates {
        let mut doc = template.clone();
        let obj = doc.as_object_mut().ok_or_else(|| "Each template must be an object".to_string())?;
        let id = value_to_str(obj.get("id")).unwrap();
        let name = value_to_str(obj.get("name")).unwrap();
        let revision = obj.get("revision").and_then(Value::as_i64).unwrap_or(1).max(1);
        let created_at = obj.get("created_at").and_then(Value::as_str).unwrap_or(&now).to_string();
        let updated_at = obj.get("updated_at").and_then(Value::as_str).unwrap_or(&created_at).to_string();
        obj.insert("revision".to_string(), Value::Number(revision.into()));
        let doc_json = serde_json::to_string(&doc).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO templates (id, name, revision, document_json, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, name, revision, doc_json, created_at, updated_at],
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO template_revisions (id, revision, document_json, saved_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, revision, doc_json, updated_at],
        ).map_err(|e| e.to_string())?;
    }

    for product in products {
        let obj = product.as_object().unwrap();
        let id = value_to_str(obj.get("id")).or_else(|| value_to_str(obj.get("PARTNO"))).or_else(|| value_to_str(obj.get("PRODUCT_SCAN"))).unwrap();
        let scan = value_to_str(obj.get("PRODUCT_SCAN")).or_else(|| value_to_str(obj.get("scan")));
        let partno = value_to_str(obj.get("PARTNO")).or_else(|| value_to_str(obj.get("partno")));
        let doc_json = serde_json::to_string(product).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO products (id, scan, partno, document_json) VALUES (?1, ?2, ?3, ?4)",
            params![id, scan, partno, doc_json],
        ).map_err(|e| e.to_string())?;
    }

    for job in jobs {
        let obj = job.as_object().unwrap();
        let id = value_to_str(obj.get("id")).unwrap();
        let created_at = obj.get("created_at").and_then(Value::as_str).unwrap_or(&now);
        let job_json = serde_json::to_string(job).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO print_jobs (id, job_json, created_at) VALUES (?1, ?2, ?3)",
            params![id, job_json, created_at],
        ).map_err(|e| e.to_string())?;
    }

    for row in audit {
        let obj = row.as_object().unwrap();
        let id = value_to_str(obj.get("id")).unwrap();
        let at = value_to_str(obj.get("at")).ok_or_else(|| "Audit entry must have a timestamp".to_string())?;
        let os_user = value_to_str(obj.get("os_user")).ok_or_else(|| "Audit entry must have an OS user".to_string())?;
        let action = value_to_str(obj.get("action")).ok_or_else(|| "Audit entry must have an action".to_string())?;
        let entity_id = value_to_str(obj.get("entity_id"));
        let details = obj.get("details").and_then(Value::as_str).unwrap_or("");
        tx.execute(
            "INSERT INTO audit (id, at, os_user, action, entity_id, details) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, at, os_user, action, entity_id, details],
        ).map_err(|e| e.to_string())?;
    }

    for batch in batches {
        let obj = batch.as_object().unwrap();
        let id = value_to_str(obj.get("id")).unwrap();
        let filename = value_to_str(obj.get("filename")).unwrap_or_else(|| "import".to_string());
        let created_at = value_to_str(obj.get("timestamp")).or_else(|| value_to_str(obj.get("created_at"))).unwrap_or_else(|| now.clone());
        let report_json = serde_json::to_string(batch).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO import_batches (id, filename, report_json, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, filename, report_json, created_at],
        ).map_err(|e| e.to_string())?;
    }

    for (key, value) in preferences {
        tx.execute(
            "INSERT INTO kv (key, value) VALUES (?1, ?2)",
            params![key, value.as_str().unwrap()],
        ).map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(json!({
        "templates": templates.len(),
        "products": products.len(),
        "jobs": jobs.len(),
        "audit": audit.len(),
        "import_batches": batches.len(),
        "preferences": preferences.len()
    }))
}

#[tauri::command]
pub fn backup_db(state: State<'_, DbState>, dest_path: String) -> Result<String, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    // Flush changes to disk and safely copy via SQLite VACUUM INTO or file copy
    let dest_clean = dest_path.replace('\'', "''");
    conn.execute(&format!("VACUUM INTO '{}'", dest_clean), [])
        .or_else(|_| {
            std::fs::copy(&state.1, &dest_path)
                .map(|_| 0)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
        })
        .map_err(|e| format!("Échec de la sauvegarde SQLite : {}", e))?;
    Ok(dest_path)
}

#[tauri::command]
pub fn restore_db(state: State<'_, DbState>, source_path: String) -> Result<String, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let source_path_buf = std::path::PathBuf::from(&source_path);
    if !source_path_buf.exists() {
        return Err("Le fichier source de restauration n'existe pas".to_string());
    }

    // Verify source database can be opened
    let temp_conn = Connection::open(&source_path_buf).map_err(|e| format!("Base source invalide : {}", e))?;
    drop(temp_conn);

    // Replace db file
    std::fs::copy(&source_path_buf, &state.1).map_err(|e| format!("Échec du remplacement de la base : {}", e))?;

    // Reopen and run migrations
    let mut new_conn = Connection::open(&state.1).map_err(|e| format!("Échec de réouverture de la base : {}", e))?;
    crate::db::migrate(&mut new_conn).map_err(|e| format!("Échec de la migration après restauration : {}", e))?;
    *conn = new_conn;

    Ok("Base SQLite restaurée avec succès".to_string())
}

#[tauri::command]
pub fn mcp_draft_list() -> Result<Vec<Value>, String> {
    let directory = crate::mcp_server::draft_directory()?;
    if !directory.exists() {
        return Ok(Vec::new());
    }
    let entries = std::fs::read_dir(directory).map_err(|error| format!("Unable to list MCP drafts: {error}"))?;
    let mut drafts = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("Unable to read MCP draft entry: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let Some(id) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        if !id.starts_with("mcp_") {
            continue;
        }
        let metadata = std::fs::metadata(&path).map_err(|error| format!("Unable to inspect MCP draft: {error}"))?;
        if metadata.len() > 2_097_152 {
            continue;
        }
        let contents = std::fs::read_to_string(&path).map_err(|error| format!("Unable to read MCP draft: {error}"))?;
        let template: Value = serde_json::from_str(&contents).map_err(|error| format!("Invalid MCP draft JSON: {error}"))?;
        crate::mcp_server::validate_template(&template)?;
        drafts.push(json!({
            "id": id,
            "name": template.get("name").and_then(Value::as_str).unwrap_or("Untitled draft"),
            "width_mm": template.get("width_mm"),
            "height_mm": template.get("height_mm"),
            "item_count": template.get("items").and_then(Value::as_array).map(Vec::len).unwrap_or(0)
        }));
    }
    drafts.sort_by(|left, right| left["id"].as_str().cmp(&right["id"].as_str()));
    Ok(drafts)
}

#[tauri::command]
pub fn mcp_draft_read(id: String) -> Result<Value, String> {
    let path = crate::mcp_server::safe_draft_path(&id)?;
    let metadata = std::fs::metadata(&path).map_err(|error| format!("Unable to inspect MCP draft: {error}"))?;
    if metadata.len() > 2_097_152 {
        return Err("MCP draft exceeds the 2 MB safety limit.".to_string());
    }
    let contents = std::fs::read_to_string(path).map_err(|error| format!("Unable to read MCP draft: {error}"))?;
    let template: Value = serde_json::from_str(&contents).map_err(|error| format!("Invalid MCP draft JSON: {error}"))?;
    crate::mcp_server::validate_template(&template)?;
    Ok(template)
}

#[tauri::command]
pub fn mcp_draft_remove(id: String) -> Result<(), String> {
    let path = crate::mcp_server::safe_draft_path(&id)?;
    if !path.exists() {
        return Err("MCP draft was already removed.".to_string());
    }
    std::fs::remove_file(path).map_err(|error| format!("Unable to remove MCP draft: {error}"))
}
