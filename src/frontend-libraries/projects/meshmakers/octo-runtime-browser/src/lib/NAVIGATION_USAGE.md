# Runtime Browser Navigation

## Toolbar Actions

The `RuntimeBrowserComponent` includes a toolbar with the following actions:

### Left Toolbar Actions
- **Goto Entity**: Opens an input dialog to navigate to a specific entity using the `ckTypeId@rtId` format

### Right Toolbar Actions  
- **Refresh**: Refreshes the tree data by reloading root nodes

## Goto Entity Feature

### Usage
1. Click the "Goto Entity" button in the toolbar
2. Enter entity identifier in the format: `ckTypeId@rtId`
3. Click "Go" to navigate to the entity details page

### Format
The entity identifier must be in the format: `ckTypeId@rtId`

### Examples
- `Basic/TreeNode@507f1f77bcf86cd799439011`
- `Basic/Asset@60d5ecb74f8b3c001c3e4b2a`
- `Basic/Tree@60d5ecb74f8b3c001c3e4b2b`

### Navigation Flow
1. **Dialog Opens**: Input dialog prompts for entity identifier
2. **Format Validation**: Validates `ckTypeId@rtId` format
3. **Entity Verification**: Verifies entity exists in the database using GraphQL
4. **Base64 Encoding**: Encodes identifier for URL safety
5. **Route Navigation**: Navigates to `/{tenantId}/repository/browser/entity/{base64EncodedId}`
6. **Entity Display**: Entity detail page decodes identifier and displays entity information

### Features

- **Format Validation**: Validates `ckTypeId@rtId` format before processing
- **Base64 Encoding**: URL-safe encoding of entity identifiers with special characters
- **GraphQL Verification**: Confirms entity exists before navigation
- **Tenant-Aware**: Automatically includes current tenant ID in navigation
- **Entity Identifier Display**: Shows full `ckTypeId@rtId` format in entity details
- **Copy Functionality**: Copy entity identifier to clipboard
- **Error Handling**: Graceful error handling with console logging

### Technical Implementation

```typescript
// Dialog call
const entityIdentifier = await this.inputService.showInputDialog(
  'Go to Entity',
  'Enter entity identifier in format "ckTypeId@rtId":',
  'ckTypeId@rtId',
  'Go'
);

// Format validation
if (!RtEntityIdHelper.isValidFormat(entityIdentifier)) {
  console.error('Invalid entity identifier format');
  return;
}

// Base64 encoding for URL safety
const encodedId = RtEntityIdHelper.encodeFromString(entityIdentifier);

// Navigation to entity details
await this.router.navigate([
  '/', tenantId, 'repository', 'browser', 'entity', encodedId
]);
```

### Base64 Encoding Details

The system uses URL-safe Base64 encoding to handle entity identifiers that may contain special characters:

- **Input Format**: `Basic/TreeNode@507f1f77bcf86cd799439011`
- **Base64 Encoded**: `QmFzaWMvVHJlZU5vZGVANTA3ZjFmNzdiY2Y4NmNkNzk5NDM5MDEx`
- **URL-Safe**: Replaces `+` with `-`, `/` with `_`, and removes `=` padding

### Entity Detail Page Integration

The entity detail page automatically:
1. Decodes the Base64 encoded identifier from the URL
2. Parses it back to `ckTypeId@rtId` format
3. Fetches entity details using GraphQL
4. Displays the entity information with copy functionality
5. Shows the full entity identifier for easy copying

### Error Handling

The function handles several error cases:
- Invalid format (not containing exactly one '@' separator)
- Entity not found in the database
- Missing tenant ID in route
- GraphQL query failures

All errors are logged to the console for debugging.