import { NextResponse } from 'next/server';
import { processDocument, createKnowledgeBase, saveKnowledgeBase, loadKnowledgeBase, listKnowledgeBases, initDatabase, KnowledgeBase } from '../../../lib/knowledge-graph';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
  try {
    await initDatabase();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const knowledgeBaseId = formData.get('knowledgeBaseId') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    let knowledgeBase: KnowledgeBase | undefined;
    if (knowledgeBaseId) {
      knowledgeBase = await loadKnowledgeBase(knowledgeBaseId);
      if (!knowledgeBase) {
        return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
      }
    } else {
      knowledgeBase = createKnowledgeBase(file.name.replace(/\.[^/.]+$/, ''));
    }
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    let content = '';
    
    // Supported formats
    if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json' || ext === 'html' || ext === 'xml') {
      content = buffer.toString('utf-8');
    }
    else if (ext === 'pdf' || ext === 'docx' || ext === 'pptx' || ext === 'xlsx') {
      // For Office & PDF files, convert using markitdown CLI tool
      // Install: pip install markitdown
      // Usage: markitdown file.pdf > output.md
      return NextResponse.json({
        error: `${ext.toUpperCase()} files need to be converted first.`,
        hint: 'Use the markitdown tool: pip install markitdown && markitdown yourfile.pdf > output.md, then upload the .md file',
        supportedFormats: ['txt', 'md', 'csv', 'json', 'html', 'xml'],
      }, { status: 400 });
    }
    else {
      // Try to read as text
      content = buffer.toString('utf-8');
    }
    
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
    }
    
    const chunks = await processDocument(content, file.name, knowledgeBase.id);
    knowledgeBase.chunks.push(...chunks);
    await saveKnowledgeBase(knowledgeBase);
    
    return NextResponse.json({
      success: true,
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        chunkCount: knowledgeBase.chunks.length,
      },
      addedChunks: chunks.length,
      charCount: content.length,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  await initDatabase();
  const bases = await listKnowledgeBases();
  
  return NextResponse.json({
    knowledgeBases: bases.map((kb) => ({
      id: kb.id,
      name: kb.name,
      chunkCount: kb.chunks.length,
      createdAt: kb.createdAt,
    })),
  });
}