import OpenAI from 'openai';

// Venice API uses OpenAI-compatible endpoint
const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY || 'dummy-key-for-build',
  baseURL: 'https://api.venice.ai/api/v1',
  defaultHeaders: {
    'x-gateway': 'openai-compatible',
  },
});

// Venice embedding models (from venice-api-kit)
const AVAILABLE_EMBEDDING_MODELS = [
  'text-embedding-3-small',  // 1536 dimensions
  'text-embedding-3-large',  // 3072 dimensions
  'text-embedding-ada-002',  // 1536 dimensions
];

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_TEXT_MODEL = 'qwen2.5-7b-instruct';

export async function getEmbeddingModel(): Promise<string> {
  try {
    const models = await venice.models.list();
    const embeddingModels = models.data.filter((m: any) => 
      m.id.includes('embedding') || 
      m.id.includes('embed')
    );
    
    if (embeddingModels.length > 0) {
      console.log('Available embedding models:', embeddingModels.map((m: any) => m.id).join(', '));
      return embeddingModels[0].id;
    }
    
    // Fallback to known Venice models
    console.log('Using default embedding model:', DEFAULT_EMBEDDING_MODEL);
    return DEFAULT_EMBEDDING_MODEL;
  } catch (error) {
    console.log('Error fetching models, using default:', error);
    return DEFAULT_EMBEDDING_MODEL;
  }
}

export async function getTextModel(): Promise<string> {
  try {
    const models = await venice.models.list();
    const textModels = models.data.filter((m: any) => 
      m.id.includes('qwen') || m.id.includes('llama')
    );
    
    if (textModels.length > 0) {
      return textModels[0].id;
    }
    return DEFAULT_TEXT_MODEL;
  } catch {
    return DEFAULT_TEXT_MODEL;
  }
}

export async function createEmbedding(text: string, model?: string): Promise<number[]> {
  const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
  
  console.log(`Creating embedding with Venice model: ${embeddingModel}`);
  
  const response = await venice.embeddings.create({
    model: embeddingModel,
    input: text,
  });
  
  const dimensions = response.data[0].embedding.length;
  console.log(`Embedding created, dimensions: ${dimensions}`);
  
  return response.data[0].embedding;
}

export async function chatCompletion(messages: any[], model?: string) {
  const textModel = model || DEFAULT_TEXT_MODEL;
  
  console.log(`Using Venice text model: ${textModel}`);
  
  const response = await venice.chat.completions.create({
    model: textModel,
    messages: messages,
    temperature: 0.7,
    max_tokens: 2000,
  });
  
  return response.choices[0].message.content;
}

export { AVAILABLE_EMBEDDING_MODELS };
export default venice;