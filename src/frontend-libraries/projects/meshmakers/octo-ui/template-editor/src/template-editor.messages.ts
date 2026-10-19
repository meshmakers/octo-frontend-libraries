import { MmTranslationTable } from '@meshmakers/shared-ui';

export const TEMPLATE_EDITOR_KEY = 'MM.OCTO_UI.TEMPLATE_EDITOR';

export const DEFAULT_TEMPLATE_EDITOR_MESSAGES: MmTranslationTable = {
  MM: {
    OCTO_UI: {
      TEMPLATE_EDITOR: {
        insertingInto: 'Inserting into:',
        search: 'Search placeholders...',
        example: 'e.g.',
        inUse: 'Used {{count}}× in this template',
        noResults: 'No placeholder matches "{{term}}"',
        clearSearch: 'Clear search',
        inserted: 'Inserted {{token}}',
        hint: 'Pick a placeholder to drop it in at the cursor.',
        queryRow: 'Query row',
        count: 'Number of rows',
        countNote: 'Subject and body'
      }
    }
  }
};
