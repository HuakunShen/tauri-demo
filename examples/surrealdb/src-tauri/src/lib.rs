use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use surrealdb::RecordId;
use surrealdb::Surreal;
use tauri::{Manager, State};
use tokio::sync::Mutex as TokioMutex;

use surrealdb::engine::local::{Db, RocksDb};

#[derive(Debug, Serialize)]
struct Name {
    first: String,
    last: String,
}

#[derive(Debug, Serialize)]
struct Person {
    title: String,
    name: Name,
    marketing: bool,
}

#[derive(Debug, Serialize)]
struct Responsibility {
    marketing: bool,
}

#[derive(Debug, Deserialize)]
pub struct Record {
    #[allow(dead_code)]
    id: RecordId,
}

pub struct Database {
    db: TokioMutex<Surreal<Db>>,
}

impl Database {
    pub async fn new() -> Result<Self, surrealdb::Error> {
        let db = Surreal::new::<RocksDb>("./surrealdb.db").await?;

        // Initialize database
        db.use_ns("test").use_db("test").await?;

        Ok(Self {
            db: TokioMutex::new(db),
        })
    }

    pub async fn create_person(
        &self,
        title: String,
        first_name: String,
        last_name: String,
    ) -> Result<Option<Record>, surrealdb::Error> {
        let db = self.db.lock().await;

        let created: Option<Record> = db
            .create("person")
            .content(Person {
                title,
                name: Name {
                    first: first_name,
                    last: last_name,
                },
                marketing: true,
            })
            .await?;

        Ok(created)
    }

    pub async fn get_people(&self) -> Result<Vec<Record>, surrealdb::Error> {
        let db = self.db.lock().await;
        let people: Vec<Record> = db.select("person").await?;
        Ok(people)
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
    first_name: String,
    last_name: String,
) -> Result<String, String> {
    db.create_person(title, first_name.clone(), last_name.clone())
        .await
        .map(|_| format!("Created person: {} {}", first_name, last_name))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_people(db: State<'_, Database>) -> Result<String, String> {
    db.get_people()
        .await
        .map(|people| format!("Found {} people", people.len()))
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database
            let rt = tokio::runtime::Runtime::new().unwrap();
            let db = rt.block_on(async {
                Database::new()
                    .await
                    .expect("Failed to initialize database")
            });

            // Manage the database state
            app.manage(db);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, create_person, get_people])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
