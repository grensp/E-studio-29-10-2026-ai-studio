use serde::{Deserialize, Serialize};
use serde_json::{Map, Number, Value};
use sqlx::{
    mysql::{MySqlConnectOptions, MySqlPoolOptions, MySqlRow, MySqlSslMode},
    postgres::{PgConnectOptions, PgPoolOptions, PgRow, PgSslMode},
    sqlite::{SqliteConnectOptions, SqlitePoolOptions, SqliteRow},
    types::Json,
    Column, Row, TypeInfo, ValueRef,
};
use std::time::Duration;

const MAX_PREVIEW_ROWS: usize = 5_000;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalDbConfig {
    driver: String,
    host: String,
    port: Option<u16>,
    database: String,
    schema: Option<String>,
    username: String,
    password: String,
    ssl_ca_path: Option<String>,
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalDbPreview {
    headers: Vec<String>,
    rows: Vec<Value>,
    truncated: bool,
}

fn validate_config(config: &ExternalDbConfig) -> Result<(), String> {
    if let Some(ca_path) = config.ssl_ca_path.as_deref() {
        if !ca_path.trim().is_empty() && !std::path::Path::new(ca_path).is_file() {
            return Err("The TLS CA certificate file does not exist or is not a file.".to_string());
        }
    }
    match config.driver.as_str() {
        "sqlite"
            if config
                .path
                .as_deref()
                .is_some_and(|path| !path.trim().is_empty()) =>
        {
            Ok(())
        }
        "sqlite" => Err("Select a SQLite database file.".to_string()),
        "postgres" | "mysql" if config.host.trim().is_empty() => {
            Err("A database host is required.".to_string())
        }
        "postgres" | "mysql"
            if config.database.trim().is_empty() || config.username.trim().is_empty() =>
        {
            Err("A database name and username are required.".to_string())
        }
        "postgres" | "mysql" => Ok(()),
        _ => Err("Unsupported database type.".to_string()),
    }
}

fn safe_error(error: sqlx::Error, password: &str) -> String {
    let message = error.to_string();
    if password.is_empty() {
        message
    } else {
        message.replace(password, "[redacted]")
    }
}

fn quote_identifier(identifier: &str, quote: char) -> String {
    let escaped = identifier.replace(quote, &format!("{quote}{quote}"));
    format!("{quote}{escaped}{quote}")
}

macro_rules! decode_decimal_if_supported {
    ($row:ident, $index:ident, $column:ident, true) => {
        $row.try_get::<rust_decimal::Decimal, _>($index)
            .ok()
            .map(|value| Value::String(value.to_string()))
    };
    ($row:ident, $index:ident, $column:ident, false) => {
        None
    };
}

macro_rules! define_row_converter {
    ($converter:ident, $row_type:ty, $supports_decimal:ident) => {
        fn $converter(row: &$row_type) -> Result<Map<String, Value>, String> {
            let mut values = Map::new();
            for (index, column) in row.columns().iter().enumerate() {
                let raw = row.try_get_raw(index).map_err(|error| {
                    format!("Unable to read column '{}': {error}", column.name())
                })?;
                let type_name = column.type_info().name().to_ascii_lowercase();
                let value = if raw.is_null() {
                    Value::Null
                } else if matches!(type_name.as_str(), "bool" | "boolean") {
                    Value::Bool(row.try_get::<bool, _>(index).map_err(|error| {
                        format!("Unable to read boolean column '{}': {error}", column.name())
                    })?)
                } else if let Ok(value) = row.try_get::<String, _>(index) {
                    Value::String(value)
                } else if let Ok(value) = row.try_get::<i64, _>(index) {
                    Value::Number(value.into())
                } else if let Some(value) =
                    decode_decimal_if_supported!(row, index, column, $supports_decimal)
                {
                    value
                } else if let Ok(value) = row.try_get::<f64, _>(index) {
                    Number::from_f64(value).map(Value::Number).ok_or_else(|| {
                        format!("Column '{}' contains a non-finite number.", column.name())
                    })?
                } else if let Ok(value) = row.try_get::<Json<Value>, _>(index) {
                    value.0
                } else if let Ok(value) = row.try_get::<chrono::NaiveDate, _>(index) {
                    Value::String(value.to_string())
                } else if let Ok(value) = row.try_get::<chrono::NaiveDateTime, _>(index) {
                    Value::String(value.to_string())
                } else if let Ok(value) = row.try_get::<chrono::NaiveTime, _>(index) {
                    Value::String(value.to_string())
                } else if let Ok(value) = row.try_get::<uuid::Uuid, _>(index) {
                    Value::String(value.to_string())
                } else {
                    return Err(format!(
                        "Column '{}' uses a data type that cannot be imported as a catalog value.",
                        column.name()
                    ));
                };
                values.insert(column.name().to_string(), value);
            }
            Ok(values)
        }
    };
}

define_row_converter!(sqlite_row_to_json, SqliteRow, false);
define_row_converter!(postgres_row_to_json, PgRow, true);
define_row_converter!(mysql_row_to_json, MySqlRow, true);

fn preview<R: Row>(
    mut rows: Vec<R>,
    convert: impl Fn(&R) -> Result<Map<String, Value>, String>,
) -> Result<ExternalDbPreview, String> {
    let truncated = rows.len() > MAX_PREVIEW_ROWS;
    rows.truncate(MAX_PREVIEW_ROWS);
    let headers = rows
        .first()
        .map(|row| {
            row.columns()
                .iter()
                .map(|column| column.name().to_string())
                .collect()
        })
        .unwrap_or_default();
    let rows = rows
        .iter()
        .map(convert)
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(Value::Object)
        .collect();
    Ok(ExternalDbPreview {
        headers,
        rows,
        truncated,
    })
}

#[tauri::command]
pub async fn external_db_list_tables(config: ExternalDbConfig) -> Result<Vec<String>, String> {
    validate_config(&config)?;
    let password = config.password.clone();
    match config.driver.as_str() {
        "sqlite" => {
            let options = SqliteConnectOptions::new()
                .filename(config.path.as_deref().unwrap_or_default())
                .read_only(true)
                .create_if_missing(false)
                .busy_timeout(Duration::from_secs(5));
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let result = sqlx::query_scalar::<_, String>(
                "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
            )
            .fetch_all(&pool)
            .await
            .map_err(|error| safe_error(error, &password));
            pool.close().await;
            result
        }
        "postgres" => {
            let mut options = PgConnectOptions::new()
                .host(&config.host)
                .port(config.port.unwrap_or(5432))
                .username(&config.username)
                .password(&config.password)
                .database(&config.database)
                .ssl_mode(PgSslMode::VerifyFull);
            if let Some(ca_path) = config
                .ssl_ca_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
            {
                options = options.ssl_root_cert(ca_path);
            }
            let pool = PgPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(10))
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let schema = config.schema.as_deref().unwrap_or("public");
            let result = sqlx::query_scalar::<_, String>(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name",
            )
            .bind(schema)
            .fetch_all(&pool)
            .await
            .map_err(|error| safe_error(error, &password));
            pool.close().await;
            result
        }
        "mysql" => {
            let mut options = MySqlConnectOptions::new()
                .host(&config.host)
                .port(config.port.unwrap_or(3306))
                .username(&config.username)
                .password(&config.password)
                .database(&config.database)
                .ssl_mode(MySqlSslMode::VerifyIdentity);
            if let Some(ca_path) = config
                .ssl_ca_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
            {
                options = options.ssl_ca(ca_path);
            }
            let pool = MySqlPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(10))
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let result = sqlx::query_scalar::<_, Vec<u8>>(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
            )
            .bind(&config.database)
            .fetch_all(&pool)
            .await
            .map_err(|error| safe_error(error, &password));
            pool.close().await;
            result.and_then(|names| {
                names
                    .into_iter()
                    .map(|name| {
                        String::from_utf8(name).map_err(|error| {
                            format!("Unable to decode table name as UTF-8: {error}")
                        })
                    })
                    .collect()
            })
        }
        _ => Err("Unsupported database type.".to_string()),
    }
}

#[tauri::command]
pub async fn external_db_fetch_table(
    config: ExternalDbConfig,
    table: String,
) -> Result<ExternalDbPreview, String> {
    validate_config(&config)?;
    if table.trim().is_empty() {
        return Err("Select a table to import.".to_string());
    }
    let password = config.password.clone();
    match config.driver.as_str() {
        "sqlite" => {
            let options = SqliteConnectOptions::new()
                .filename(config.path.as_deref().unwrap_or_default())
                .read_only(true)
                .create_if_missing(false)
                .busy_timeout(Duration::from_secs(5));
            let pool = SqlitePoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(10))
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let query = format!(
                "SELECT * FROM {} LIMIT {}",
                quote_identifier(&table, '"'),
                MAX_PREVIEW_ROWS + 1
            );
            let rows = sqlx::query(&query)
                .fetch_all(&pool)
                .await
                .map_err(|error| safe_error(error, &password));
            pool.close().await;
            preview(rows?, sqlite_row_to_json)
        }
        "postgres" => {
            let mut options = PgConnectOptions::new()
                .host(&config.host)
                .port(config.port.unwrap_or(5432))
                .username(&config.username)
                .password(&config.password)
                .database(&config.database)
                .ssl_mode(PgSslMode::VerifyFull);
            if let Some(ca_path) = config
                .ssl_ca_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
            {
                options = options.ssl_root_cert(ca_path);
            }
            let pool = PgPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(10))
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let schema = config.schema.as_deref().unwrap_or("public");
            let query = format!(
                "SELECT * FROM {}.{} LIMIT {}",
                quote_identifier(schema, '"'),
                quote_identifier(&table, '"'),
                MAX_PREVIEW_ROWS + 1
            );
            let rows = sqlx::query(&query)
                .fetch_all(&pool)
                .await
                .map_err(|error| safe_error(error, &password));
            pool.close().await;
            preview(rows?, postgres_row_to_json)
        }
        "mysql" => {
            let mut options = MySqlConnectOptions::new()
                .host(&config.host)
                .port(config.port.unwrap_or(3306))
                .username(&config.username)
                .password(&config.password)
                .database(&config.database)
                .ssl_mode(MySqlSslMode::VerifyIdentity);
            if let Some(ca_path) = config
                .ssl_ca_path
                .as_deref()
                .filter(|path| !path.trim().is_empty())
            {
                options = options.ssl_ca(ca_path);
            }
            let pool = MySqlPoolOptions::new()
                .max_connections(1)
                .acquire_timeout(Duration::from_secs(10))
                .connect_with(options)
                .await
                .map_err(|error| safe_error(error, &password))?;
            let query = format!(
                "SELECT * FROM {} LIMIT {}",
                quote_identifier(&table, '`'),
                MAX_PREVIEW_ROWS + 1
            );
            let rows = sqlx::query(&query)
                .fetch_all(&pool)
                .await
                .map_err(|error| safe_error(error, &password));
            pool.close().await;
            preview(rows?, mysql_row_to_json)
        }
        _ => Err("Unsupported database type.".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(driver: &str) -> ExternalDbConfig {
        ExternalDbConfig {
            driver: driver.to_string(),
            host: String::new(),
            port: None,
            database: String::new(),
            schema: None,
            username: String::new(),
            password: String::new(),
            ssl_ca_path: None,
            path: None,
        }
    }

    #[test]
    fn validates_supported_connection_requirements() {
        assert!(validate_config(&config("unknown")).is_err());
        assert!(validate_config(&config("sqlite")).is_err());
        let mut missing_ca = config("sqlite");
        missing_ca.path = Some("catalog.sqlite".to_string());
        missing_ca.ssl_ca_path = Some("/file/that/does/not/exist.pem".to_string());
        assert!(validate_config(&missing_ca).unwrap_err().contains("TLS CA"));

        let mut pg = config("postgres");
        pg.host = "db.local".to_string();
        pg.database = "catalog".to_string();
        pg.username = "reader".to_string();
        assert!(validate_config(&pg).is_ok());
        pg.host.clear();
        assert!(validate_config(&pg).is_err());
    }

    #[test]
    fn quotes_identifiers_for_each_supported_sql_dialect() {
        assert_eq!(
            quote_identifier("items\"; DROP TABLE x;--", '"'),
            "\"items\"\"; DROP TABLE x;--\""
        );
        assert_eq!(quote_identifier("items`--", '`'), "`items``--`");
    }

    #[tokio::test]
    async fn reads_sqlite_tables_read_only_and_caps_preview_rows() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "estudio-external-db-{}-{unique}.sqlite",
            std::process::id()
        ));
        let connection = rusqlite::Connection::open(&path).expect("create test database");
        connection
            .execute(
                "CREATE TABLE catalog (id INTEGER, name TEXT, active BOOLEAN)",
                [],
            )
            .expect("create test table");
        for id in 0..=MAX_PREVIEW_ROWS {
            connection
                .execute(
                    "INSERT INTO catalog (id, name, active) VALUES (?1, ?2, ?3)",
                    rusqlite::params![id as i64, format!("Item {id}"), id % 2 == 0],
                )
                .expect("insert test row");
        }
        drop(connection);

        let mut database = config("sqlite");
        database.path = Some(path.to_string_lossy().into_owned());
        let tables = external_db_list_tables(database.clone())
            .await
            .expect("discover external SQLite table");
        assert_eq!(tables, vec!["catalog"]);
        let imported = external_db_fetch_table(database, "catalog".to_string())
            .await
            .expect("read external SQLite table");
        assert_eq!(imported.rows.len(), MAX_PREVIEW_ROWS);
        assert!(imported.truncated);
        assert_eq!(imported.rows[0]["id"], 0);
        assert_eq!(imported.rows[0]["active"], true);
        std::fs::remove_file(path).expect("remove test database");
    }

    #[tokio::test]
    #[ignore = "requires a TLS-enabled PostgreSQL or MySQL test service"]
    async fn reads_rows_from_tls_verified_external_database() {
        let driver = std::env::var("ESTUDIO_DB_TEST_DRIVER").expect("set ESTUDIO_DB_TEST_DRIVER");
        assert!(matches!(driver.as_str(), "postgres" | "mysql"));
        let port = std::env::var("ESTUDIO_DB_TEST_PORT")
            .expect("set ESTUDIO_DB_TEST_PORT")
            .parse::<u16>()
            .expect("valid test port");
        let database = ExternalDbConfig {
            driver,
            host: std::env::var("ESTUDIO_DB_TEST_HOST").unwrap_or_else(|_| "localhost".into()),
            port: Some(port),
            database: std::env::var("ESTUDIO_DB_TEST_NAME").expect("set ESTUDIO_DB_TEST_NAME"),
            schema: Some(
                std::env::var("ESTUDIO_DB_TEST_SCHEMA").unwrap_or_else(|_| "public".into()),
            ),
            username: std::env::var("ESTUDIO_DB_TEST_USER").expect("set ESTUDIO_DB_TEST_USER"),
            password: std::env::var("ESTUDIO_DB_TEST_PASSWORD")
                .expect("set ESTUDIO_DB_TEST_PASSWORD"),
            ssl_ca_path: Some(std::env::var("ESTUDIO_DB_TEST_CA").expect("set ESTUDIO_DB_TEST_CA")),
            path: None,
        };
        let mut untrusted = database.clone();
        untrusted.ssl_ca_path = None;
        assert!(
            external_db_list_tables(untrusted).await.is_err(),
            "TLS connections must reject the test server without its trusted CA"
        );
        let tables = external_db_list_tables(database.clone())
            .await
            .expect("discover test catalog table");
        assert!(tables.contains(&"catalog_probe".to_string()));
        let rows = external_db_fetch_table(database.clone(), "catalog_probe".into())
            .await
            .expect("fetch test catalog rows");
        assert_eq!(rows.headers, vec!["id", "name", "amount"]);
        assert_eq!(rows.rows.len(), 1);
        assert_eq!(rows.rows[0]["name"], "Verified TLS");
        assert_eq!(rows.rows[0]["amount"], "12.50");
    }
}
