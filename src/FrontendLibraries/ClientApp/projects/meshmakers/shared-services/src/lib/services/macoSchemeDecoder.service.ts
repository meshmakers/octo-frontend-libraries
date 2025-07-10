import { Injectable } from "@angular/core";

export interface ParseResult {
  location: string;
  machineId: string;
}

export interface ParseResponse {
  success: boolean;
  message: string;
  data?: ParseResult;
}

@Injectable()
export class MacoSchemeDecoderService {
  private locationMap: Record<string, string> = {
    AT10: 'ATSA',
    AT20: 'ATTR',
    AT30: 'ATMA',
    DE20: 'DEHE',
    PL91: 'POGL',
  };

  /**
   * Parses a MACO scheme URL and extracts a mapped location code and machine ID from the last URL segment.
   *
   * @param url - The URL to parse.
   * @returns A `ParseResponse` containing:
   *  - `success: true` with extracted location and machine ID if parsing is successful.
   *  - `success: false` with an error message if the input is invalid or cannot be parsed.
   */
  parseUrl(url: string): ParseResponse {
    if (!url || url.trim() === '') {
      return {
        success: false,
        message: 'The URL is empty. Please enter a valid URL.'
      };
    }

    // Extract last path segment
    const parts = url.split('/');
    const lastSegment = parts.pop() || '';

    if (!lastSegment) {
      return {
        success: false,
        message: 'URL does not contain a valid last segment.'
      };
    }

    if (lastSegment.length < 4) {
      return {
        success: false,
        message: 'The last segment format is invalid or too short.'
      };
    }

    const locationCode = lastSegment.substring(0, 4); // e.g. 'AT10'
    const machineCode = lastSegment.substring(4); // e.g. 'MAFEB2'

    const mappedLocation = this.locationMap[locationCode];

    if (!this.locationMap[locationCode]) {
      return {
        success: false,
        message: 'Location code is not recognized or supported.'
      };
    }

    if (!machineCode || machineCode.trim() === '') {
      return {
        success: false,
        message: 'Machine identifier is missing.'
      };
    }

    return {
      success: true,
      message: `Successfully parsed URL: location=${this.locationMap[locationCode]}, machine=${machineCode}`,
      data: {
        location: this.locationMap[locationCode],
        machineId: machineCode,
      }
    };
  }
}
