import { WebSearchService } from './web-search.service';
import { logger } from '../utils/logger';
import axios from 'axios';

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
        name: 'search_manual_pdfs',
        description:
          'Search for equipment manuals in PDF format. ALWAYS default to manual_type="service_manual" unless user explicitly asks for user manual. Service manuals include technical, repair, and maintenance documentation.',
        parameters: {
          type: 'object',
          properties: {
            equipment_name: {
              type: 'string',
              description:
                'The name, brand, or model of the equipment (e.g., "Carrier 58CVA furnace", "Samsung refrigerator RF28", "John Deere 5075E")',
            },
            manual_type: {
              type: 'string',
              description:
                'Type of manual needed. DEFAULT TO "service_manual" for technical documentation. Only use "user_manual" if explicitly requested.',
              enum: ['user_manual', 'service_manual', 'installation_guide', 'parts_list', 'any'],
              default: 'service_manual',
            },
          },
          required: ['equipment_name'],
        },
      },
      {
        type: 'function',
        name: 'email_manual',
        description:
          "Email a found manual or document to the user. Use this after finding a manual PDF to send it to the user's email address.",
        parameters: {
          type: 'object',
          properties: {
            to_email: {
              type: 'string',
              description: 'The recipient email address',
            },
            manual_url: {
              type: 'string',
              description: 'The URL of the PDF manual to send',
            },
            equipment_name: {
              type: 'string',
              description: 'The name of the equipment the manual is for',
            },
            manual_type: {
              type: 'string',
              description: 'The type of manual (user guide, service manual, etc.)',
            },
          },
          required: ['to_email', 'manual_url', 'equipment_name'],
        },
      },
      {
        type: 'function',
        name: 'search_web',
        description:
          'Search the internet for current information, news, facts, or answers to questions. Use this for general searches, not for finding PDFs.',
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
        case 'search_manual_pdfs':
          return await this.handleManualSearch(
            args as {
              equipment_name: string;
              manual_type?: string;
            },
          );

        case 'email_manual':
          return await this.handleEmailManual(
            args as {
              to_email: string;
              manual_url: string;
              equipment_name: string;
              manual_type?: string;
            },
          );

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
   * Handle manual PDF search
   */
  private static async handleManualSearch(args: {
    equipment_name: string;
    manual_type?: string;
  }): Promise<FunctionCallResult> {
    if (!args.equipment_name) {
      return { success: false, error: 'Equipment name is required' };
    }

    // Build search query specifically for PDF manuals
    const manualTypeMap: Record<string, string> = {
      user_manual: 'user manual owner manual',
      service_manual: 'service manual repair manual technical manual',
      installation_guide: 'installation guide install manual',
      parts_list: 'parts list parts catalog parts manual',
      any: 'manual guide',
    };

    // Default to service_manual for technical documentation
    const manualType = args.manual_type || 'service_manual';
    const manualKeywords = manualTypeMap[manualType] || 'service manual technical manual';
    const searchQuery = `"${args.equipment_name}" ${manualKeywords} filetype:pdf OR ext:pdf`;

    logger.info('Searching for equipment manual PDFs', {
      equipment: args.equipment_name,
      type: args.manual_type,
      query: searchQuery,
    });

    const searchResult = await WebSearchService.search(searchQuery);

    // Filter results to only include PDF links
    const pdfResults = searchResult.results.filter((result) => {
      const url = result.url.toLowerCase();
      return url.endsWith('.pdf') || url.includes('.pdf?') || url.includes('/pdf/');
    });

    if (pdfResults.length === 0) {
      // Try a broader search if no PDFs found
      const broaderQuery = `${args.equipment_name} manual PDF download`;
      const broaderSearchResult = await WebSearchService.search(broaderQuery);

      const broaderPdfResults = broaderSearchResult.results.filter((result) => {
        const url = result.url.toLowerCase();
        return url.endsWith('.pdf') || url.includes('.pdf?') || url.includes('/pdf/');
      });

      if (broaderPdfResults.length === 0) {
        return {
          success: true,
          data: {
            message: `No PDF manuals found for "${args.equipment_name}". Try being more specific with the model number or brand name.`,
            equipment: args.equipment_name,
            manual_type: args.manual_type,
            results: [],
          },
        };
      }

      return {
        success: true,
        data: {
          equipment: args.equipment_name,
          manual_type: args.manual_type,
          results: broaderPdfResults.map((result) => ({
            title: result.title,
            url: result.url,
            snippet: result.snippet.substring(0, 200) + '...',
          })),
          summary: `Found ${broaderPdfResults.length} PDF manual(s) for "${args.equipment_name}".`,
        },
      };
    }

    return {
      success: true,
      data: {
        equipment: args.equipment_name,
        manual_type: args.manual_type,
        results: pdfResults.map((result) => ({
          title: result.title,
          url: result.url,
          snippet: result.snippet.substring(0, 200) + '...',
        })),
        summary: `Found ${pdfResults.length} PDF manual(s) for "${args.equipment_name}".`,
      },
    };
  }

  /**
   * Handle email manual sending
   */
  private static async handleEmailManual(args: {
    to_email: string;
    manual_url: string;
    equipment_name: string;
    manual_type?: string;
  }): Promise<FunctionCallResult> {
    if (!args.to_email || !args.manual_url || !args.equipment_name) {
      return {
        success: false,
        error: 'Email, manual URL, and equipment name are required',
      };
    }

    try {
      // Create dynamic subject line based on equipment
      const manualTypeText =
        args.manual_type === 'service_manual'
          ? 'Service Manual'
          : args.manual_type === 'user_manual'
            ? 'User Manual'
            : args.manual_type === 'parts_list'
              ? 'Parts List'
              : args.manual_type === 'installation_guide'
                ? 'Installation Guide'
                : 'Technical Manual';

      const subject = `📘 ${args.equipment_name} ${manualTypeText} - Ready to Download`;

      // Professional HTML email template
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
    <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #c8102e;">
            <h1 style="color: #c8102e; margin: 0; font-size: 28px;">📘 Manual Found!</h1>
            <p style="color: #666; margin-top: 10px; font-size: 16px;">${args.equipment_name}</p>
        </div>
        
        <!-- Main Content -->
        <div style="margin-bottom: 30px;">
            <p style="font-size: 16px; color: #333;">Your requested ${manualTypeText.toLowerCase()} is ready for download:</p>
            
            <!-- Download Button -->
            <div style="text-align: center; margin: 30px 0;">
                <a href="${args.manual_url}" style="display: inline-block; padding: 15px 35px; background: linear-gradient(135deg, #c8102e 0%, #e63946 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(200, 16, 46, 0.3); transition: all 0.3s;">📥 Download ${manualTypeText}</a>
            </div>
            
            <!-- Manual Details -->
            <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #c8102e; margin-top: 0; font-size: 18px;">📋 Manual Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px 0; color: #666; width: 40%;"><strong>Equipment:</strong></td>
                        <td style="padding: 8px 0; color: #333;">${args.equipment_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>Manual Type:</strong></td>
                        <td style="padding: 8px 0; color: #333;">${manualTypeText}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; color: #666;"><strong>Format:</strong></td>
                        <td style="padding: 8px 0; color: #333;">PDF Document</td>
                    </tr>
                </table>
            </div>
            
            <!-- Alternative Link -->
            <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    <strong>💡 Tip:</strong> If the button doesn't work, copy this link:<br>
                    <span style="word-break: break-all; font-size: 12px; color: #0066cc;">${args.manual_url}</span>
                </p>
            </div>
        </div>
        
        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">Parts Manual Assistant</p>
            <p style="color: #999; font-size: 12px; margin-top: 5px;">Your technical documentation partner</p>
        </div>
    </div>
</body>
</html>
      `;

      // Plain text version
      const textContent = `${args.equipment_name} ${manualTypeText}

Your requested manual is ready for download:

${args.manual_url}

Manual Details:
- Equipment: ${args.equipment_name}
- Type: ${manualTypeText}
- Format: PDF Document

If you have any issues accessing the manual, simply copy and paste the link above into your browser.

Best regards,
Parts Manual Assistant`;

      // Send email via PartnerGPT API
      const emailResponse = await axios.post(
        'https://partnergpt.up.railway.app/api/email/send',
        {
          to: args.to_email,
          subject,
          text: textContent,
          html: htmlContent,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      if (emailResponse.data.success) {
        return {
          success: true,
          data: {
            message: `Manual successfully emailed to ${args.to_email}`,
            email: args.to_email,
            manual_url: args.manual_url,
            equipment: args.equipment_name,
          },
        };
      } else {
        return {
          success: false,
          error: `Failed to send email: ${emailResponse.data.error || 'Unknown error'}`,
        };
      }
    } catch (error) {
      logger.error('Failed to send manual email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        args,
      });

      return {
        success: false,
        error: `Failed to email manual: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
