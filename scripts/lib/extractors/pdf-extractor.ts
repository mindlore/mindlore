import pdfParse from 'pdf-parse';

export interface PdfExtraction {
  title: string;
  author: string;
  page_count: number;
  abstract: string;
  ingested_at: string;
}

export async function extractPdf(buffer: Buffer): Promise<PdfExtraction> {
  const data = await pdfParse(buffer);
  return {
    title: data.info?.Title ?? 'Untitled PDF',
    author: data.info?.Author ?? 'Unknown',
    page_count: data.numpages,
    abstract: data.text.slice(0, 500).trim(),
    ingested_at: new Date().toISOString(),
  };
}
