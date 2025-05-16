import { NextRequest, NextResponse } from 'next/server';
import { getUserForms } from '@/lib/form-service';

// GET /api/forms
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const forms = await getUserForms(teamId);
    return NextResponse.json({ data: forms });
  } catch (error) {
    console.error('[API] GET /api/forms error', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
} 