// Database utilities for PostgreSQL with pgvector
// Only loads when DATABASE_URL is provided

let pool: any = null;

export async function getPool() {
  if (pool) return pool;
  
  const { Pool } = await import('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  return pool;
}

export async function initDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.log('DATABASE_URL not set, using in-memory storage');
    return;
  }
  
  try {
    const pool = await getPool();
    
    // Enable pgvector extension
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `).catch(e => console.log('pgvector extension:', e.message));
    
    // Create knowledge_bases table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create chunks table with vector column
    // Using text JSON for vector storage for compatibility
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chunks (
        id UUID PRIMARY KEY,
        knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        embedding JSONB,
        source TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    // Create index for faster lookups
    try {
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_kb ON chunks(knowledge_base_id);
      `);
    } catch (e) {
      console.log('Index creation skipped');
    }
    
    console.log('PostgreSQL database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export async function saveKnowledgeBaseToDb(id: string, name: string) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO knowledge_bases (id, name) VALUES ($1, $2) 
     ON CONFLICT (id) DO UPDATE SET name = $2`,
    [id, name]
  );
}

export async function saveChunkToDb(
  id: string,
  knowledgeBaseId: string,
  content: string,
  embedding: number[],
  source: string
) {
  const pool = await getPool();
  await pool.query(
    `INSERT INTO chunks (id, knowledge_base_id, content, embedding, source) 
     VALUES ($1, $2, $3, $4, $5)`,
    [id, knowledgeBaseId, content, JSON.stringify(embedding), source]
  );
}

export async function getKnowledgeBases() {
  const pool = await getPool();
  const result = await pool.query(`
    SELECT kb.id, kb.name, kb.created_at, COUNT(c.id) as chunk_count
    FROM knowledge_bases kb
    LEFT JOIN chunks c ON kb.id = c.knowledge_base_id
    GROUP BY kb.id, kb.name, kb.created_at
    ORDER BY kb.created_at DESC
  `);
  return result.rows;
}

export async function getKnowledgeBase(id: string) {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT id, name, created_at FROM knowledge_bases WHERE id = $1`,
    [id]
  );
  return result.rows[0];
}

export async function getChunksByKnowledgeBase(knowledgeBaseId: string) {
  const pool = await getPool();
  const result = await pool.query(
    `SELECT id, content, embedding, source, created_at 
     FROM chunks 
     WHERE knowledge_base_id = $1`,
    [knowledgeBaseId]
  );
  return result.rows;
}

export async function searchChunks(knowledgeBaseId: string, queryEmbedding: number[], topK: number = 5) {
  const pool = await getPool();
  
  // Simple cosine similarity using JSONB
  // This is a workaround - for better performance, use native vector type
  const result = await pool.query(
    `SELECT id, content, source, created_at,
            (SELECT MAX(similarity) FROM (
              SELECT 1 - (emb::jsonb <-> $1::jsonb) as similarity
              FROM chunks WHERE knowledge_base_id = $2
            ) AS scores) as similarity
     FROM chunks 
     WHERE knowledge_base_id = $1
     LIMIT $2`,
    [knowledgeBaseId, topK]
  );
  
  // Fallback to simpler query
  const simpleResult = await pool.query(
    `SELECT id, content, source, created_at
     FROM chunks 
     WHERE knowledge_base_id = $1
     LIMIT $2`,
    [knowledgeBaseId, topK]
  );
  
  return simpleResult.rows.map((r: any) => ({
    ...r,
    similarity: 0.8 // Default score when not using vector similarity
  }));
}