import { NextResponse } from 'next/server';
import venice from '../../../lib/venice';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  
  try {
    const models = await venice.models.list();
    const filtered = type === 'all' 
      ? models.data 
      : models.data.filter((m: any) => m.id.includes(type));
    
    return NextResponse.json({
      data: filtered,
      object: 'list',
      type,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}