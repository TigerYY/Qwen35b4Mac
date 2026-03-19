import type { SearchProviderPreference } from '../types';

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  provider?: 'sogou' | 'duckduckgo';
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36';
const MAX_RESULTS = 5;
const MAX_QUERY_LENGTH = 50;

/** Clean and shorten query for better engine match: trim, remove trailing ?, truncate. */
function cleanSearchQuery(query: string): string {
  let q = query.trim().replace(/[？?]\s*$/, '').replace(/\s+/g, ' ').trim();
  if (q.length > MAX_QUERY_LENGTH) q = q.slice(0, MAX_QUERY_LENGTH);
  return q || query.trim().slice(0, MAX_QUERY_LENGTH);
}

/** Heuristic: query looks like English / tech (overseas-first). */
function prefersOverseas(query: string): boolean {
  const trimmed = query.trim();
  const cjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(trimmed);
  if (cjk && trimmed.length <= 8) return false;
  const techTerms = /\b(api|npm|github|stackoverflow|docs?|tutorial|react|vue|python|javascript|typescript)\b/i;
  const mostlyAscii = (trimmed.match(/[a-zA-Z]/g)?.length ?? 0) / Math.max(trimmed.length, 1) > 0.5;
  return techTerms.test(trimmed) || (mostlyAscii && trimmed.length > 4);
}

/** Resolve effective engine: 'sogou' | 'duckduckgo' based on preference and query. */
export function getEffectiveProvider(
  query: string,
  preference: SearchProviderPreference
): 'sogou' | 'duckduckgo' {
  if (preference === 'domesticFirst') return 'sogou';
  if (preference === 'overseasFirst') return 'duckduckgo';
  return prefersOverseas(query) ? 'duckduckgo' : 'sogou';
}

async function searchSogou(query: string): Promise<SearchResult[]> {
  const url = `/api/search/sogou?query=${encodeURIComponent(query)}`;
  if (import.meta.env.DEV) console.debug('[search] Sogou request query:', query.slice(0, 60));
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) throw new Error(`Sogou search failed: ${response.status}`);
  const htmlText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  function parseSogouElements(elements: NodeListOf<Element>): SearchResult[] {
    const out: SearchResult[] = [];
    for (let i = 0; i < elements.length && out.length < MAX_RESULTS; i++) {
      const el = elements[i];
      const titleEl = el.querySelector('.vr-title, .pt > a, h3 > a, a[href^="http"]');
      const snippetEl = el.querySelector('.star-wiki, .ft, .str-text-info, .space-txt, .str_info, .content');
      const urlEl = titleEl;
      let title = '';
      let snippet = '';
      const url = urlEl?.getAttribute('href') || '';
      if (titleEl && snippetEl) {
        title = titleEl.textContent?.trim().replace(/\s+/g, ' ') || '';
        snippet = snippetEl.textContent?.trim().replace(/\s+/g, ' ') || '';
      } else if (titleEl) {
        title = titleEl.textContent?.trim().replace(/\s+/g, ' ') || '';
        const fullText = el.textContent?.trim().replace(/\s+/g, ' ') || '';
        snippet = fullText.length > title.length ? fullText.substring(title.length).trim() : fullText;
      } else {
        const fullText = el.textContent?.trim().replace(/\s+/g, ' ') || '';
        if (fullText.length > 20) {
          title = '搜索结果';
          snippet = fullText;
        }
      }
      if (title && snippet && !title.includes('单位换算')) {
        out.push({
          title,
          snippet: snippet.substring(0, 500),
          url,
          provider: 'sogou'
        });
      }
    }
    return out;
  }

  let results = parseSogouElements(doc.querySelectorAll('.vrwrap, .rb'));
  if (results.length === 0) {
    results = parseSogouElements(doc.querySelectorAll('.results div[class*="vr"], .res-list .rb, article'));
  }
  if (results.length === 0 && import.meta.env.DEV) {
    console.warn('[search] Sogou parsed 0 results, HTML length:', htmlText.length, 'preview:', htmlText.slice(0, 300));
  }
  return results;
}

async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const url = `/api/search/duckduckgo?q=${encodeURIComponent(query)}`;
  if (import.meta.env.DEV) console.debug('[search] DuckDuckGo request query:', query.slice(0, 60));
  const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html'
      }
    }
  );
  if (!response.ok) throw new Error(`DuckDuckGo search failed: ${response.status}`);
  const htmlText = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  function parseDDGElements(elements: NodeListOf<Element>): SearchResult[] {
    const out: SearchResult[] = [];
    for (let i = 0; i < elements.length && out.length < MAX_RESULTS; i++) {
      const el = elements[i];
      const titleLink = el.querySelector('.result__title a, .result__a, a[href*="uddg"]');
      const snippetEl = el.querySelector('.result__snippet, .result__body');
      const title = titleLink?.textContent?.trim().replace(/\s+/g, ' ') || '';
      const snippet = snippetEl?.textContent?.trim().replace(/\s+/g, ' ') || el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 300) || '';
      let url = titleLink?.getAttribute('href') || '';
      if (url.startsWith('//duckduckgo.com/l/?')) {
        try {
          const u = new URL(url, 'https:');
          url = u.searchParams.get('uddg') || url;
        } catch {
          // keep url as is
        }
      }
      if (title && snippet.length > 10) {
        out.push({
          title,
          snippet: snippet.substring(0, 500),
          url: url || title,
          provider: 'duckduckgo'
        });
      }
    }
    return out;
  }

  let results = parseDDGElements(doc.querySelectorAll('.result'));
  if (results.length === 0) {
    results = parseDDGElements(doc.querySelectorAll('.results_links .result'));
  }
  if (results.length === 0 && import.meta.env.DEV) {
    console.warn('[search] DuckDuckGo parsed 0 results, HTML length:', htmlText.length, 'preview:', htmlText.slice(0, 300));
  }
  return results;
}

/**
 * Search with provider preference and fallback.
 * Tries effective provider first; on empty or error, falls back to the other.
 */
export async function searchWeb(
  query: string,
  preference: SearchProviderPreference = 'auto'
): Promise<SearchResult[]> {
  const cleaned = cleanSearchQuery(query);
  const primary = getEffectiveProvider(cleaned, preference);
  const secondary: 'sogou' | 'duckduckgo' = primary === 'sogou' ? 'duckduckgo' : 'sogou';

  const run = (engine: 'sogou' | 'duckduckgo') =>
    engine === 'sogou' ? searchSogou(cleaned) : searchDuckDuckGo(cleaned);

  let results = await run(primary).catch(() => []);
  if (results.length === 0) {
    results = await run(secondary).catch(() => []);
  }
  return results;
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return '';
  let formatted = '【网络检索结果】\n';
  results.forEach((res, i) => {
    formatted += `[${i + 1}] ${res.title}\n摘要: ${res.snippet}\n${res.url ? `链接: ${res.url}\n` : ''}\n`;
  });
  return formatted;
}

/** Format results as a short source list for attribution. */
export function formatSearchSources(results: SearchResult[]): string {
  if (results.length === 0) return '';
  return results.map((r, i) => `[${i + 1}] ${r.title} ${r.url ? `(${r.url})` : ''}`).join('\n');
}
