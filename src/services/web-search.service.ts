import { logger } from '../utils/logger';

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  totalResults: number;
}

/**
 * Web Search Service using SerpAPI
 * Provides internet search capabilities for the AI assistant
 */
export class WebSearchService {
  private static readonly SEARCH_API_URL = 'https://serpapi.com/search';
  private static readonly API_KEY =
    '7219228e748003a6e5394610456ef659f7c7884225b2df7fb0a890da61ad7f48';
  private static readonly MAX_RESULTS = 5;
  private static readonly TIMEOUT = 15000; // 15 seconds

  /**
   * Search the web for information
   */
  static async search(query: string): Promise<WebSearchResponse> {
    try {
      logger.info('Performing web search with SerpAPI', { query });

      // Use SerpAPI for web search
      const params = new URLSearchParams({
        q: query,
        api_key: this.API_KEY,
        engine: 'google',
        num: this.MAX_RESULTS.toString(),
      });

      const response = await fetch(`${this.SEARCH_API_URL}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Parts-API/1.0',
        },
        signal: AbortSignal.timeout(this.TIMEOUT),
      });

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Check for API errors
      if (data.error) {
        throw new Error(`SerpAPI error: ${data.error}`);
      }

      // Parse SerpAPI response
      const results: WebSearchResult[] = [];

      // Add answer box if available (direct answers)
      if (data.answer_box) {
        const answerBox = data.answer_box;
        results.push({
          title: answerBox.title || 'Direct Answer',
          snippet: answerBox.answer || answerBox.snippet || answerBox.result || '',
          url: answerBox.link || '',
        });
      }

      // Add knowledge graph if available
      if (data.knowledge_graph) {
        const kg = data.knowledge_graph;
        results.push({
          title: kg.title || 'Knowledge Graph',
          snippet: kg.description || kg.snippet || '',
          url: kg.source?.link || '',
        });
      }

      // Add organic search results
      if (data.organic_results && Array.isArray(data.organic_results)) {
        data.organic_results.slice(0, this.MAX_RESULTS - results.length).forEach((result: any) => {
          if (result.title && result.snippet) {
            results.push({
              title: result.title,
              snippet:
                result.snippet.substring(0, 300) + (result.snippet.length > 300 ? '...' : ''),
              url: result.link || '',
            });
          }
        });
      }

      logger.info('Web search completed', {
        query,
        resultsCount: results.length,
        hasAnswerBox: !!data.answer_box,
        hasKnowledgeGraph: !!data.knowledge_graph,
      });

      return {
        query,
        results,
        totalResults: results.length,
      };
    } catch (error) {
      logger.error('Web search failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return empty results on error
      return {
        query,
        results: [],
        totalResults: 0,
      };
    }
  }

  /**
   * Get current weather information
   */
  static async getWeather(location: string): Promise<WebSearchResponse> {
    const query = `weather ${location} current temperature`;
    return this.search(query);
  }

  /**
   * Get latest news on a topic
   */
  static async getNews(topic: string): Promise<WebSearchResponse> {
    const query = `${topic} news latest 2024`;
    return this.search(query);
  }

  /**
   * Get stock information
   */
  static async getStockInfo(symbol: string): Promise<WebSearchResponse> {
    const query = `${symbol} stock price current market`;
    return this.search(query);
  }

  /**
   * Get general factual information
   */
  static async getFactualInfo(question: string): Promise<WebSearchResponse> {
    return this.search(question);
  }
}
