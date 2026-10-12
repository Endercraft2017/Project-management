/**
 * OpenAI Service
 * Handles all interactions with OpenAI GPT-3.5 Turbo API
 * Includes retry logic, error handling, and rate limiting
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Impact assessment result from AI
 */
export interface ImpactAssessment {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

/**
 * Weekly summary result from AI
 */
export interface WeeklySummaryResult {
  summary: string;
  impact: ImpactAssessment;
}

/**
 * Daily update data structure
 */
export interface DailyUpdateData {
  date: string;
  content: string;
}

class OpenAIService {
  private client: OpenAI | null = null;
  private readonly model = 'gpt-3.5-turbo';
  private readonly maxRetries = 3;
  private readonly temperature = 0.7;

  /**
   * Create the OpenAI client on first use, so the server (and anything that
   * imports this module) starts without OPENAI_API_KEY. Only AI summaries
   * need it, and they fail with a clear error when it's missing.
   */
  private getClient(): OpenAI {
    if (this.client) return this.client;

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY is not configured. Please set it in your environment variables.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      maxRetries: this.maxRetries,
      timeout: 60000, // 60 seconds
    });
    return this.client;
  }

  /**
   * Generate a weekly summary for a team member based on their daily updates
   * Also determines the impact level of their work
   */
  async generateWeeklySummary(
    memberName: string,
    dailyUpdates: DailyUpdateData[]
  ): Promise<WeeklySummaryResult> {
    if (!dailyUpdates || dailyUpdates.length === 0) {
      return {
        summary: `${memberName} did not submit any updates this week.`,
        impact: {
          level: 'LOW',
          reasoning: 'No updates submitted',
        },
      };
    }

    // Format updates for the prompt
    const updatesText = dailyUpdates
      .map((update) => `Date: ${update.date}\nUpdate: ${update.content}`)
      .join('\n\n');

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: `You are an AI assistant that analyzes team member work updates and creates concise summaries. Your task is to:
1. Summarize the week's work in 2-4 sentences, highlighting key achievements and progress
2. Assess the impact level (HIGH, MEDIUM, or LOW) based on:
   - HIGH: Major Contributions to the progress and development of the project, critical bugs fixed, or significant milestones reached, blockers resolved, high business value delivered, managed team goals or managed team workload
   - MEDIUM: Regular progress on features, moderate bug fixes, steady contribution to team goals
   - LOW: Minor updates, limited progress, mostly routine tasks, or minimal contributions
3. Provide reasoning for the impact assessment

Return your response in the following JSON format:
{
  "summary": "Your 2-4 sentence summary here",
  "impactLevel": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Brief explanation for the impact level"
}`,
      },
      {
        role: 'user',
        content: `Team member: ${memberName}\n\nWeekly updates:\n${updatesText}\n\nPlease provide a summary and impact assessment.`,
      },
    ];

    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('OpenAI returned empty response');
      }

      // Parse the JSON response
      const parsed = JSON.parse(content) as {
        summary: string;
        impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
        reasoning: string;
      };

      // Validate the response structure
      if (!parsed.summary || !parsed.impactLevel || !parsed.reasoning) {
        throw new Error('Invalid response structure from OpenAI');
      }

      // Validate impact level
      if (!['HIGH', 'MEDIUM', 'LOW'].includes(parsed.impactLevel)) {
        throw new Error(`Invalid impact level: ${parsed.impactLevel}`);
      }

      return {
        summary: parsed.summary,
        impact: {
          level: parsed.impactLevel,
          reasoning: parsed.reasoning,
        },
      };
    } catch (error) {
      // Handle specific OpenAI errors
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
          throw new Error(
            'OpenAI rate limit exceeded. Please try again later.'
          );
        } else if (error.status === 401) {
          throw new Error(
            'OpenAI API key is invalid. Please check your configuration.'
          );
        } else if (error.status === 503) {
          throw new Error(
            'OpenAI service is temporarily unavailable. Please try again later.'
          );
        }
        throw new Error(`OpenAI API error: ${error.message}`);
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new Error('Failed to parse OpenAI response');
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Test the OpenAI connection and API key validity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getClient().chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: 'Say "Connection successful" if you can read this.',
          },
        ],
        max_tokens: 10,
      });

      return !!response.choices[0]?.message?.content;
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI connection test failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current rate limit status from the last request headers
   * This is useful for monitoring and preventing rate limit issues
   */
  getRateLimitInfo(response: OpenAI.Chat.Completions.ChatCompletion): {
    remaining: number | null;
    limit: number | null;
    resetAt: Date | null;
  } {
    // Note: Rate limit info is typically in response headers
    // This is a placeholder for future implementation when headers are accessible
    return {
      remaining: null,
      limit: null,
      resetAt: null,
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
