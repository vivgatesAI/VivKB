import { NextResponse } from 'next/server';
import { processDocument, createKnowledgeBase, saveKnowledgeBase, loadKnowledgeBase, listKnowledgeBases, initDatabase, KnowledgeBase } from '../../../lib/knowledge-graph';

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
    
    if (ext === 'txt' || ext === 'md' || ext === 'csv' || ext === 'json') {
      content = buffer.toString('utf-8');
    } else if (ext === 'pdf' || ext === 'docx') {
      return NextResponse.json({
        error: 'For PDF/DOCX files, please convert to markdown first using: pip install markitdown && markitdown yourfile.pdf > output.md, then upload the .md file',
      }, { status: 400 });
    } else {
      content = buffer.toString('utf-8');
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
    });
  } catch (error: any) {
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