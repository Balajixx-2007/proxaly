require('dotenv').config()

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL
}

function ensureMigrationsDir() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`)
  }
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
}

async function ensureSchemaVersionTable(client) {
  await client.query(`
    create table if not exists schema_version (
      version text primary key,
      applied_at timestamptz default now()
    )
  `)
}

async function getAppliedVersions(client) {
  const { rows } = await client.query('select version from schema_version')
  return new Set(rows.map(r => r.version))
}

async function applyMigration(client, version, sql) {
  await client.query('begin')
  try {
    await client.query(sql)
    await client.query('insert into schema_version(version) values($1) on conflict (version) do nothing', [version])
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  }
}

async function run() {
  const connectionString = getDatabaseUrl()
  if (!connectionString) {
    throw new Error('Missing SUPABASE_DB_URL (or DATABASE_URL/POSTGRES_URL) in environment')
  }

  ensureMigrationsDir()

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    await ensureSchemaVersionTable(client)
    const applied = await getAppliedVersions(client)
    const files = listMigrationFiles()

    if (files.length === 0) {
      console.log('No migration files found.')
      return
    }

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file} (already applied)`)
        continue
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`Applying ${file}...`)
      await applyMigration(client, file, sql)
      console.log(`Applied ${file}`)
    }

    console.log('Migration run complete.')
  } finally {
    await client.end()
  }
}

run().catch(err => {
  console.error(`Migration failed: ${err.message}`)
  process.exit(1)
})
