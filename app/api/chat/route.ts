import { NextResponse } from 'next/server';
import { searchKnowledgeBase, loadKnowledgeBase, initDatabase } from '../../../lib/knowledge-graph';
import { chatCompletion } from '../../../lib/venice';

export async function POST(request: Request) {
  try {
    await initDatabase();
    
    const { message, knowledgeBaseId, model } = await request.json();
    
    if (!message || !knowledgeBaseId) {
      return NextResponse.json(
        { error: 'Message and knowledgeBaseId are required' },
        { status: 400 }
      );
    }
    
    const knowledgeBase = await loadKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      return NextResponse.json({ error: 'Knowledge base not found' }, { status: 404 });
    }
    
    if (knowledgeBase.chunks.length === 0) {
      return NextResponse.json({
        response: 'This knowledge base is empty. Please upload some documents first.',
        sources: [],
      });
    }
    
    const { chunks, scores } = await searchKnowledgeBase(knowledgeBase, message, 5);
    
    const context = chunks
      .map((chunk, i) => `[Source ${i + 1} (${chunk.metadata.source})]: ${chunk.content}`)
      .join('\n\n');
    
    const systemPrompt = `You are a helpful AI assistant answering questions based on a knowledge base.
Use the provided context from documents to answer questions accurately.
If the answer is not in the context, say so clearly.
Always cite your sources when possible.

Context:
${context}

Question: ${message}

Answer:`;
    
    const response = await chatCompletion(
      [{ role: 'user', content: systemPrompt }],
      model
    );
    
    return NextResponse.json({
      response,
      sources: chunks.map((chunk, i) => ({
        content: chunk.content.slice(0, 200) + '...',
        source: chunk.metadata.source,
        score: scores[i],
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}