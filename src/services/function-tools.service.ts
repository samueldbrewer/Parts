import { WebSearchService } from './web-search.service';
import { logger } from '../utils/logger';

export interface FunctionTool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

export interface FunctionCallResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Function Tools Service
 * Handles function calling for the OpenAI Realtime API
 */
export class FunctionToolsService {
  /**
   * Get available function tools
   */
  static getAvailableTools(): FunctionTool[] {
    return [
      {
        type: 'function',
        name: 'search_web',
        description:
          'Search the internet for current information, news, facts, or answers to questions',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to find information about',
            },
          },
          required: ['query'],
        },
      },
      {
        type: 'function',
        name: 'get_weather',
        description: 'Get current weather information for a specific location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city, state, or country to get weather for',
            },
          },
          required: ['location'],
        },
      },
      {
        type: 'function',
        name: 'get_news',
        description: 'Get latest news about a specific topic or general news',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description:
                'The news topic to search for (e.g., "technology", "politics", "sports")',
            },
          },
          required: ['topic'],
        },
      },
      {
        type: 'function',
        name: 'get_stock_info',
        description: 'Get current stock price and information for a company',
        parameters: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'The stock symbol (e.g., "AAPL", "TSLA", "MSFT")',
            },
          },
          required: ['symbol'],
        },
      },
      {
        type: 'function',
        name: 'get_current_time',
        description: 'Get the current date and time',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Optional timezone (e.g., "America/New_York", "Europe/London")',
            },
          },
          required: [],
        },
      },
    ];
  }

  /**
   * Execute a function call
   */
  static async executeFunction(
    functionName: string,
    args: Record<string, any>,
  ): Promise<FunctionCallResult> {
    try {
      logger.info('Executing function call', { functionName, args });

      switch (functionName) {
        case 'search_web':
          return await this.handleWebSearch(args as { query: string });

        case 'get_weather':
          return await this.handleWeatherRequest(args as { location: string });

        case 'get_news':
          return await this.handleNewsRequest(args as { topic: string });

        case 'get_stock_info':
          return await this.handleStockInfoRequest(args as { symbol: string });

        case 'get_current_time':
          return await this.handleCurrentTimeRequest(args);

        default:
          logger.warn('Unknown function call', { functionName });
          return {
            success: false,
            error: `Unknown function: ${functionName}`,
          };
      }
    } catch (error) {
      logger.error('Function execution failed', {
        functionName,
        args,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Function execution failed',
      };
    }
  }

  /**
   * Handle web search
   */
  private static async handleWebSearch(args: { query: string }): Promise<FunctionCallResult> {
    if (!args.query) {
      return { success: false, error: 'Query parameter is required' };
    }

    const searchResult = await WebSearchService.search(args.query);

    if (searchResult.results.length === 0) {
      return {
        success: true,
        data: {
          message: `No results found for "${args.query}". The information might not be available or the search terms might need to be adjusted.`,
          query: args.query,
          results: [],
        },
      };
    }

    // Format results for the AI
    const formattedResults = searchResult.results.map((result) => ({
      title: result.title,
      snippet: result.snippet.substring(0, 300) + (result.snippet.length > 300 ? '...' : ''),
      url: result.url,
    }));

    return {
      success: true,
      data: {
        query: args.query,
        results: formattedResults,
        summary: `Found ${searchResult.totalResults} results for "${args.query}".`,
      },
    };
  }

  /**
   * Handle weather request
   */
  private static async handleWeatherRequest(args: {
    location: string;
  }): Promise<FunctionCallResult> {
    if (!args.location) {
      return { success: false, error: 'Location parameter is required' };
    }

    const weatherResult = await WebSearchService.getWeather(args.location);

    return {
      success: true,
      data: {
        location: args.location,
        results: weatherResult.results,
        summary: `Weather information for ${args.location}`,
      },
    };
  }

  /**
   * Handle news request
   */
  private static async handleNewsRequest(args: { topic: string }): Promise<FunctionCallResult> {
    if (!args.topic) {
      return { success: false, error: 'Topic parameter is required' };
    }

    const newsResult = await WebSearchService.getNews(args.topic);

    return {
      success: true,
      data: {
        topic: args.topic,
        results: newsResult.results,
        summary: `Latest news about ${args.topic}`,
      },
    };
  }

  /**
   * Handle stock info request
   */
  private static async handleStockInfoRequest(args: {
    symbol: string;
  }): Promise<FunctionCallResult> {
    if (!args.symbol) {
      return { success: false, error: 'Symbol parameter is required' };
    }

    const stockResult = await WebSearchService.getStockInfo(args.symbol.toUpperCase());

    return {
      success: true,
      data: {
        symbol: args.symbol.toUpperCase(),
        results: stockResult.results,
        summary: `Stock information for ${args.symbol.toUpperCase()}`,
      },
    };
  }

  /**
   * Handle current time request
   */
  private static async handleCurrentTimeRequest(args: {
    timezone?: string;
  }): Promise<FunctionCallResult> {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
      };

      if (args.timezone) {
        options.timeZone = args.timezone;
      }

      const formattedTime = now.toLocaleString('en-US', options);
      const isoTime = now.toISOString();

      return {
        success: true,
        data: {
          formatted: formattedTime,
          iso: isoTime,
          timestamp: now.getTime(),
          timezone: args.timezone || 'Local',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get current time',
      };
    }
  }
}
