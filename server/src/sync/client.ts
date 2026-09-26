/**
 * Google Sheets API Client Wrapper
 * Handles authentication and basic operations
 */

import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export class GoogleSheetsClient {
  private sheets: sheets_v4.Sheets;
  private auth: JWT;

  constructor() {
    // Initialize JWT auth with service account credentials
    this.auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
        /\\n/g,
        '\n'
      ),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Initialize Sheets API client
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Verify access to a spreadsheet
   */
  async verifyAccess(spreadsheetId: string): Promise<boolean> {
    try {
      await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId',
      });
      return true;
    } catch (error: any) {
      if (error.code === 404) {
        throw new Error('Spreadsheet not found');
      }
      if (error.code === 403) {
        throw new Error(
          'Access denied. Please share the spreadsheet with the service account email.'
        );
      }
      throw error;
    }
  }

  /**
   * Get spreadsheet metadata
   */
  async getSpreadsheetInfo(spreadsheetId: string) {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,spreadsheetUrl,properties',
      });
      return response.data;
    } catch (error: any) {
      if (error.code === 404) {
        throw new Error('Spreadsheet not found');
      }
      if (error.code === 403) {
        throw new Error('Access denied to spreadsheet');
      }
      throw error;
    }
  }

  /**
   * Check if a sheet exists in the spreadsheet
   */
  async sheetExists(
    spreadsheetId: string,
    sheetName: string
  ): Promise<boolean> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title',
      });

      const sheets = response.data.sheets || [];
      return sheets.some((sheet) => sheet.properties?.title === sheetName);
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a new sheet in the spreadsheet
   */
  async createSheet(spreadsheetId: string, sheetName: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to create sheet: ${error.message}`);
    }
  }

  /**
   * Read data from a sheet range
   */
  async readSheet(
    spreadsheetId: string,
    range: string
  ): Promise<any[][] | null> {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || null;
    } catch (error: any) {
      if (error.code === 400) {
        throw new Error('Invalid range format');
      }
      throw error;
    }
  }

  /**
   * Clear data from a sheet range
   */
  async clearSheet(spreadsheetId: string, range: string): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
    } catch (error: any) {
      throw new Error(`Failed to clear sheet: ${error.message}`);
    }
  }

  /**
   * Write data to a sheet (single update)
   */
  async writeSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to write to sheet: ${error.message}`);
    }
  }

  /**
   * Batch update multiple ranges
   */
  async batchUpdateSheet(
    spreadsheetId: string,
    data: Array<{ range: string; values: any[][] }>
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: data.map((item) => ({
            range: item.range,
            values: item.values,
          })),
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to batch update sheet: ${error.message}`);
    }
  }

  /**
   * Append data to the end of a sheet
   */
  async appendToSheet(
    spreadsheetId: string,
    range: string,
    values: any[][]
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values,
        },
      });
    } catch (error: any) {
      throw new Error(`Failed to append to sheet: ${error.message}`);
    }
  }

  /**
   * Format sheet headers (bold, freeze first row)
   */
  async formatHeaders(
    spreadsheetId: string,
    sheetId: number
  ): Promise<void> {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat.textFormat.bold',
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      });
    } catch (error: any) {
      // Non-critical, don't throw
      console.warn(`Failed to format headers: ${error.message}`);
    }
  }

  /**
   * Get the sheet ID by name
   */
  async getSheetId(
    spreadsheetId: string,
    sheetName: string
  ): Promise<number | null> {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties',
      });

      const sheets = response.data.sheets || [];
      const sheet = sheets.find((s) => s.properties?.title === sheetName);

      return sheet?.properties?.sheetId ?? null;
    } catch (error) {
      return null;
    }
  }
}

// Singleton instance
let clientInstance: GoogleSheetsClient | null = null;

export function getGoogleSheetsClient(): GoogleSheetsClient {
  if (!clientInstance) {
    clientInstance = new GoogleSheetsClient();
  }
  return clientInstance;
}
