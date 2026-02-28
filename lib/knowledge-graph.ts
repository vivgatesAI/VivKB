import { createEmbedding } from './venice';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase as initDb, saveKnowledgeBaseToDb, saveChunkToDb, getKnowledgeBases, getKnowledgeBase, getChunksByKnowledgeBase, searchChunks } from './db';

export interface Chunk {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    source: string;
    knowledgeBaseId: string;
    createdAt: string;
  };
}

export interface KnowledgeBase {
  id: string;
  name: string;
  chunks: Chunk[];
  createdAt: string;
}

const CHUNK_SIZE = 1000;
const USE_DB = !!process.env.DATABASE_URL;

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > CHUNK_SIZE) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += ' ' + sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  return chunks;
}

export async function processDocument(
  content: string,
  sourceName: string,
  knowledgeBaseId: string
): Promise<Chunk[]> {
  const chunks = splitIntoChunks(content);
  const processedChunks: Chunk[] = [];
  
  console.log(`Processing ${chunks.length} chunks for ${sourceName}...`);
  
  for (const chunk of chunks) {
    const embedding = await createEmbedding(chunk);
    processedChunks.push({
      id: uuidv4(),
      content: chunk,
      embedding,
      metadata: {
        source: sourceName,
        knowledgeBaseId,
        createdAt: new Date().toISOString(),
      },
    });
  }
  
  return processedChunks;
}

export async function searchKnowledgeBase(
  knowledgeBase: KnowledgeBase,
  query: string,
  topK: number = 5
): Promise<{ chunks: Chunk[], scores: number[] }> {
  const queryEmbedding = await createEmbedding(query);
  
  if (USE_DB) {
    const results = await searchChunks(knowledgeBase.id, queryEmbedding, topK);
    return {
      chunks: results.map((r: any) => ({
        id: r.id,
        content: r.content,
        embedding: [],
        metadata: { source: r.source, knowledgeBaseId: knowledgeBase.id, createdAt: '' }
      })),
      scores: results.map((r: any) => r.similarity || 0),
    };
  }
  
  const similarities = knowledgeBase.chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  
  similarities.sort((a, b) => b.score - a.score);
  
  return {
    chunks: similarities.slice(0, topK).map((s) => s.chunk),
    scores: similarities.slice(0, topK).map((s) => s.score),
  };
}

export async function saveKnowledgeBase(knowledgeBase: KnowledgeBase): Promise<void> {
  if (USE_DB) {
    await saveKnowledgeBaseToDb(knowledgeBase.id, knowledgeBase.name);
    for (const chunk of knowledgeBase.chunks) {
      await saveChunkToDb(chunk.id, knowledgeBase.id, chunk.content, chunk.embedding, chunk.metadata.source);
    }
    console.log(`Saved ${knowledgeBase.chunks.length} chunks to database`);
  } else {
    knowledgeBases.set(knowledgeBase.id, knowledgeBase);
  }
}

export async function loadKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
  if (USE_DB) {
    const kb = await getKnowledgeBase(id);
    if (!kb) return null;
    
    const chunks = await getChunksByKnowledgeBase(id);
    return {
      id: kb.id,
      name: kb.name,
      createdAt: kb.created_at,
      chunks: chunks.map((c: any) => ({
        id: c.id,
        content: c.content,
        embedding: [],
        metadata: { source: c.source, knowledgeBaseId: id, createdAt: c.created_at }
      }))
    };
  }
  
  return knowledgeBases.get(id) || null;
}

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  if (USE_DB) {
    const kbs = await getKnowledgeBases();
    return kbs.map((kb: any) => ({
      id: kb.id,
      name: kb.name,
      createdAt: kb.created_at,
      chunks: []
    }));
  }
  
  return Array.from(knowledgeBases.values());
}

export function createKnowledgeBase(name: string): KnowledgeBase {
  return {
    id: uuidv4(),
    name,
    chunks: [],
    createdAt: new Date().toISOString(),
  };
}

export async function initDatabase(): Promise<void> {
  if (USE_DB) {
    await initDb();
  } else {
    console.log('Using in-memory storage (set DATABASE_URL for PostgreSQL)');
  }
}

let knowledgeBases: Map<string, KnowledgeBase> = new Map();