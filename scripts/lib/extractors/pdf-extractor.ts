import pdfParse from 'pdf-parse';
import { errMsg } from '../err-msg.js';

export interface PdfExtraction {
  title: string;
  author: string;
  page_count: number;
  abstract: string;
  ingested_at: string;
}

export async function extractPdf(buffer: Buffer): Promise<PdfExtraction> {
  let data: Awaited<ReturnType<typeof pdfParse>>;
  try {
    data = await pdfParse(buffer);
  } catch (err) {
    throw new Error(`PDF parse failed: ${errMsg(err)}`);
  }
  return {
    title: data.info?.Title ?? 'Untitled PDF',
    author: data.info?.Author ?? 'Unknown',
    page_count: data.numpages,
    abstract: data.text.slice(0, 500).trim(),
    ingested_at: new Date().toISOString(),
  };
}
