import { NextResponse } from 'next/server';
import { processDocument, createKnowledgeBase, saveKnowledgeBase, loadKnowledgeBase, listKnowledgeBases, initDatabase, KnowledgeBase } from '../../../lib/knowledge-graph';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function parsePDF(fileBuffer: Buffer): Promise<string> {
  const PDFParser = await import('pdf2json');
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser.default();
    
    pdfParser.on('pdfParser_dataError', (err: any) => {
      reject(new Error(`PDF parsing error: ${err.parserError}`));
    });
    
    pdfParser.on('pdfParser_dataReady', () => {
      const text = pdfParser.getRawTextContent();
      resolve(text);
    });
    
    pdfParser.parseBuffer(fileBuffer);
  });
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

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
    
    try {
      if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json' || ext === 'html' || ext === 'xml') {
        content = buffer.toString('utf-8');
      } 
      else if (ext === 'pdf') {
        content = await parsePDF(buffer);
        console.log(`PDF parsed: ${content.length} characters`);
      } 
      else if (ext === 'docx') {
        content = await parseDOCX(buffer);
        console.log(`DOCX parsed: ${content.length} characters`);
      }
      else if (ext === 'doc') {
        return NextResponse.json({
          error: 'Old .doc format not supported. Please save as .docx or PDF.',
        }, { status: 400 });
      }
      else {
        // Try to read as text
        content = buffer.toString('utf-8');
      }
    } catch (parseError: any) {
      console.error('File parsing error:', parseError);
      return NextResponse.json({
        error: `Failed to parse file: ${parseError.message}`,
        hint: 'Try converting to markdown first: pip install markitdown && markitdown file.ext > output.md',
      }, { status: 400 });
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