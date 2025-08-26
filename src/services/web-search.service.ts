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
 * Web Search Service using DuckDuckGo Instant Answer API
 * Provides internet search capabilities for the AI assistant
 */
export class WebSearchService {
  private static readonly SEARCH_API_URL = 'https://api.duckduckgo.com/';
  private static readonly MAX_RESULTS = 5;
  private static readonly TIMEOUT = 10000; // 10 seconds

  /**
   * Search the web for information
   */
  static async search(query: string): Promise<WebSearchResponse> {
    try {
      logger.info('Performing web search', { query });

      // Use DuckDuckGo Instant Answer API
      const response = await fetch(
        `${this.SEARCH_API_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Parts-API/1.0',
          },
          signal: AbortSignal.timeout(this.TIMEOUT),
        },
      );

      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      // Parse DuckDuckGo response
      const results: WebSearchResult[] = [];

      // Add instant answer if available
      if (data.Answer) {
        results.push({
          title: 'Instant Answer',
          snippet: data.Answer,
          url: data.AnswerURL || '',
        });
      }

      // Add abstract if available
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'Summary',
          snippet: data.Abstract,
          url: data.AbstractURL || '',
        });
      }

      // Add related topics
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, this.MAX_RESULTS - results.length).forEach((topic: any) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              snippet: topic.Text,
              url: topic.FirstURL,
            });
          }
        });
      }

      // Add definition if available
      if (data.Definition) {
        results.push({
          title: 'Definition',
          snippet: data.Definition,
          url: data.DefinitionURL || '',
        });
      }

      logger.info('Web search completed', {
        query,
        resultsCount: results.length,
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
    const query = `current weather in ${location}`;
    return this.search(query);
  }

  /**
   * Get latest news on a topic
   */
  static async getNews(topic: string): Promise<WebSearchResponse> {
    const query = `latest news ${topic} ${new Date().getFullYear()}`;
    return this.search(query);
  }

  /**
   * Get stock information
   */
  static async getStockInfo(symbol: string): Promise<WebSearchResponse> {
    const query = `${symbol} stock price current`;
    return this.search(query);
  }

  /**
   * Get general factual information
   */
  static async getFactualInfo(question: string): Promise<WebSearchResponse> {
    return this.search(question);
  }
}
