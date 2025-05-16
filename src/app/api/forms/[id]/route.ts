import { NextResponse, NextRequest } from 'next/server';
import { deleteForm, getFormById } from '@/lib/form-service';

interface Params {
  params: {
    id: string;
  };
}

// DELETE /api/forms/:id
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = params;
  try {
    const result = await deleteForm(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`[API] DELETE /api/forms/${id} error`, error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}

// GET /api/forms/:id
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = params;
  try {
    const form = await getFormById(id);
    return NextResponse.json({ data: form });
  } catch (error) {
    console.error(`[API] GET /api/forms/${id} error`, error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
} 