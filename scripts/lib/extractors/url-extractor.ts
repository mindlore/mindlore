import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface UrlExtraction {
  title: string;
  canonical_url: string;
  domain: string;
  summary: string;
  fetched_at: string;
}

export async function extractUrl(url: string, html: string): Promise<UrlExtraction> {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim() || $('h1').first().text().trim() || 'Untitled';
  const metaDesc = $('meta[name="description"]').attr('content') ?? '';
  const bodyText = $('body').text().trim().slice(0, 500);
  const summary = metaDesc || bodyText.slice(0, 200);
  const u = new URL(url);
  return {
    title,
    canonical_url: url,
    domain: u.hostname,
    summary,
    fetched_at: new Date().toISOString(),
  };
}
