/**
 * The company model gateway exposes tool-calling, not a bundled browser.  Curriculum
 * alignment therefore uses a server-side public search before asking the model to
 * synthesize a cited conclusion. No user API key is sent to the search engine.
 */
export type SearchResult = { title: string; url: string; snippet: string };

function decode(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export async function searchCurriculum(query: string): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://cn.bing.com/search?q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; ChengziHandoutWorkbench/1.0)" },
      cache: "no-store"
    });
    if (!response.ok) return [];
    const html = await response.text();
    const blocks = html.match(/<li class="b_algo"[\s\S]*?<\/li>/g) ?? [];
    const keywords = query.match(/《[^》]+》|[\u4e00-\u9fff]{3,}/g)?.filter((word) => !/^(?:教材|单元|快乐读书吧|语文)$/.test(word)) ?? [];
    return blocks.slice(0, 12).map((block) => {
      const link = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      return link ? { title: decode(link[2]), url: link[1], snippet: decode(snippet?.[1] ?? "") } : null;
    }).filter((item): item is SearchResult => Boolean(item?.url && item.title))
      .filter((item) => keywords.length === 0 || keywords.some((word) => `${item.title} ${item.snippet}`.includes(word)))
      .slice(0, 5);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
