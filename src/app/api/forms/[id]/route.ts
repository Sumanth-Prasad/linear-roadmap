import { NextResponse, NextRequest } from 'next/server';
import { deleteForm } from '@/lib/form-service';

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