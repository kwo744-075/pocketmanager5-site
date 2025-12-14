import { NextResponse } from 'next/server';
import { exportPptxBuffer } from '@/lib/recognitionPptExporter';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buf = await exportPptxBuffer(body);
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="recognition-show.pptx"`,
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
