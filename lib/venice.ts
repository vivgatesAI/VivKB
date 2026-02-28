import OpenAI from 'openai';

// Use VENICE_API_KEY instead of OPENAI_API_KEY
const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY || process.env.OPENAI_API_KEY || 'dummy-key-for-build',
  baseURL: 'https://api.venice.ai/api/v1',
  defaultHeaders: {
    'x-gateway': 'openai-compatible',
  },
});

// Only validate at runtime, not build time
if (process.env.NODE_ENV === 'production' && process.env.VENICE_API_KEY) {
  console.log('Venice API configured');
}

export async function getEmbeddingModel() {
  try {
    const models = await venice.models.list();
    const embeddingModels = models.data.filter((m: any) => m.id.includes('embedding') || m.id.includes('embed'));
    return embeddingModels[0]?.id || 'text-embedding-3-small';
  } catch {
    return 'text-embedding-3-small';
  }
}

export async function getTextModel() {
  try {
    const models = await venice.models.list();
    const textModels = models.data.filter((m: any) => m.id.includes('qwen') || m.id.includes('llama'));
    return textModels[0]?.id || 'qwen2.5-7b-instruct';
  } catch {
    return 'qwen2.5-7b-instruct';
  }
}

export async function createEmbedding(text: string, model?: string): Promise<number[]> {
  const embeddingModel = model || await getEmbeddingModel();
  const response = await venice.embeddings.create({
    model: embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

export async function chatCompletion(messages: any[], model?: string) {
  const textModel = model || await getTextModel();
  const response = await venice.chat.completions.create({
    model: textModel,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2000,
  });
  return response.choices[0].message.content;
}

export default venice;