use serde::{Deserialize, Serialize};
use std::sync::Arc;
use surrealdb::RecordId;
use surrealdb::Surreal;
use tauri::{Manager, State};
use tokio::sync::Mutex;

use surrealdb::engine::local::{Db, RocksDb};

#[derive(Debug, Serialize)]
struct Person {
    title: String,
    name: String,
    marketing: bool,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Record {
    #[allow(dead_code)]
    id: RecordId,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PersonRecord {
    #[allow(dead_code)]
    id: RecordId,
    title: String,
    name: String,
    marketing: bool,
}

pub struct Database {
    db: Arc<Mutex<Surreal<Db>>>,
}

impl Database {
    pub async fn new() -> Result<Self, surrealdb::Error> {
        let db = Surreal::new::<RocksDb>("./surrealdb.db").await?;

        // Initialize database
        db.use_ns("test").use_db("test").await?;

        Ok(Self {
            db: Arc::new(Mutex::new(db)),
        })
    }

    pub async fn create_person(
        &self,
        title: String,
        name: String,
    ) -> Result<Option<Record>, surrealdb::Error> {
        let created = {
            let db = self.db.lock().await;
            let res = db
                .create("person")
                .content(Person {
                    title,
                    name,
                    marketing: true,
                })
                .await?;
            // Ensure the transaction is flushed
            db.query("COMMIT TRANSACTION").await?;
            res
        };
        Ok(created)
    }

    pub async fn get_people(&self) -> Result<Vec<PersonRecord>, surrealdb::Error> {
        let people = {
            let db = self.db.lock().await;
            // Force a new transaction
            db.query("BEGIN TRANSACTION").await?;
            let result: Vec<PersonRecord> = db.query("SELECT * FROM person").await?.take(0)?;
            // End transaction
            db.query("COMMIT TRANSACTION").await?;
            result
        };
        Ok(people)
    }

    pub async fn delete_all_people(&self) -> Result<(), surrealdb::Error> {
        {
            let db = self.db.lock().await;
            db.query("DELETE person").await?;
            // Ensure the transaction is flushed
            db.query("COMMIT TRANSACTION").await?;
        };
        Ok(())
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn create_person(
    db: State<'_, Database>,
    title: String,
    name: String,
) -> Result<String, String> {
    db.create_person(title, name.clone())
        .await
        .map(|_| format!("Created person: {}", name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_people(db: State<'_, Database>) -> Result<Vec<PersonRecord>, String> {
    match db.get_people().await {
        Ok(people) => Ok(people),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn delete_all_people(db: State<'_, Database>) -> Result<String, String> {
    match db.delete_all_people().await {
        Ok(_) => Ok("All people deleted successfully".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle();
            tauri::async_runtime::block_on(async move {
                let db = Database::new()
                    .await
                    .expect("Failed to initialize database");
                app_handle.manage(db);
            });

            // Manage the database state
            #[cfg(debug_assertions)]
            {
                // Open the developer tools in debug mode
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            create_person,
            get_people,
            delete_all_people
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
