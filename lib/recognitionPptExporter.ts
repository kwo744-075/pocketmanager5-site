import type { ShowThemeId } from './recognitionShowThemes';

export type ExportOptions = {
  period?: string | null;
  themeId?: ShowThemeId | string | null;
  personId?: string | null;
  district?: string | null;
  includeCelebrations?: boolean;
  includeOnePager?: boolean;
  includeKpis?: boolean;
};

export async function exportPptxBuffer(options: ExportOptions): Promise<Uint8Array> {
  // simple pptx generation using pptxgenjs
  try {
    const PptxGenJS = (await import('pptxgenjs')).default as any;
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE';
    pres.write('blob').then(() => {});
    // Create a simple title slide
    const slide = pres.addSlide();
    slide.addText(`Recognition Show ${options.period ?? ''}`, { x: 1, y: 1.5, fontSize: 36, color: 'FFFFFF' });
    // Add example content slide
    if (options.personId) {
      const s = pres.addSlide();
      s.addText(`Winner: ${options.personId}`, { x: 0.5, y: 1.0, fontSize: 28, color: 'FFFFFF' });
    }

    // Return ArrayBuffer via save method
    const out = await pres.write('arraybuffer');
    return new Uint8Array(out as ArrayBuffer);
  } catch (e) {
    console.error('PPTX export failed', e);
    throw e;
  }
}
