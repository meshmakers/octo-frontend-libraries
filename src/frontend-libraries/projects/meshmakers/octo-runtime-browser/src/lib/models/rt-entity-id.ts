export interface RtEntityId {
  rtId: string;
  ckTypeId: string;
}

export class RtEntityIdHelper {
  /**
   * Encodes ckTypeId@rtId into a URL-safe Base64 string for routing
   */
  static encode(rtId: string, ckTypeId: string): string {
    return btoa(`${ckTypeId}@${rtId}`).replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+':
          return '-';
        case '/':
          return '_';
        case '=':
          return '';
        default:
          return match;
      }
    });
  }

  /**
   * Encodes a ckTypeId@rtId string directly into a URL-safe Base64 string
   */
  static encodeFromString(entityIdentifier: string): string {
    return btoa(entityIdentifier).replace(/[+/=]/g, (match) => {
      switch (match) {
        case '+':
          return '-';
        case '/':
          return '_';
        case '=':
          return '';
        default:
          return match;
      }
    });
  }

  /**
   * Decodes URL parameter back to RtEntityId
   */
  static decode(encoded: string): RtEntityId {
    // Restore base64 padding and special characters
    const padded = encoded.padEnd(
      encoded.length + ((4 - (encoded.length % 4)) % 4),
      '=',
    );
    const restored = padded.replace(/-/g, '+').replace(/_/g, '/');

    try {
      const decoded = atob(restored);
      const parts = decoded.split('@');

      if (parts.length !== 2) {
        throw new Error(
          'Invalid entity identifier format. Expected "ckTypeId@rtId"',
        );
      }

      const [ckTypeId, rtId] = parts;

      if (!rtId || !ckTypeId) {
        throw new Error(
          'Invalid encoded entity ID format - missing rtId or ckTypeId',
        );
      }

      return { rtId, ckTypeId };
    } catch (error) {
      throw new Error(`Failed to decode entity ID: ${error}`);
    }
  }

  /**
   * Validates if a string is in the correct ckTypeId@rtId format
   */
  static isValidFormat(entityIdentifier: string): boolean {
    const parts = entityIdentifier.split('@');
    return (
      parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== ''
    );
  }
}
