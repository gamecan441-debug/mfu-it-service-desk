const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'itservice.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function getDatabase(dbFilePath = DB_PATH) {
    ensureDirForFile(dbFilePath);
    const db = new DatabaseSync(dbFilePath);
    db.exec('PRAGMA foreign_keys = ON;');
    return db;
}

function initializeDatabase(dbFilePath = DB_PATH) {
    ensureDirForFile(dbFilePath);
    const db = getDatabase(dbFilePath);
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);
    return db;
}

// If executed directly, run initializeDatabase
if (require.main === module) {
    console.log(`Initializing database at: ${DB_PATH}`);
    initializeDatabase();
    console.log('Database initialized successfully with schema and seed data!');
}

module.exports = {
    getDatabase,
    initializeDatabase,
    DB_PATH
};

