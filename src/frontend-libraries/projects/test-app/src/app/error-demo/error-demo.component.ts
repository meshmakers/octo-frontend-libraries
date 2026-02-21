import { Component } from '@angular/core';
import { MessageService } from '@meshmakers/shared-services';

@Component({
  selector: 'app-error-demo',
  standalone: false,
  templateUrl: './error-demo.component.html',
  styleUrls: ['./error-demo.component.scss']
})
export class ErrorDemoComponent {
  errorExamples: { title: string; message: string; description: string }[] = [
    {
      title: 'Short Error Message',
      message: 'Connection timeout: Unable to reach server.',
      description: 'A simple, one-line error message'
    },
    {
      title: 'Medium Error Message',
      message: `Failed to process request.
Error Code: 404
Timestamp: ${new Date().toISOString()}
Request ID: abc-123-def-456
Please contact support if this issue persists.`,
      description: 'Multi-line error with metadata'
    },
    {
      title: 'Long Stack Trace',
      message: `Error: Cannot read properties of undefined (reading 'value')
    at Object.getValue (/app/src/utils/dataProcessor.js:45:23)
    at processData (/app/src/services/dataService.js:128:15)
    at async handleRequest (/app/src/controllers/apiController.js:67:9)
    at async Layer.handle [as handle_request] (/node_modules/express/lib/router/layer.js:95:5)
    at async next (/node_modules/express/lib/router/route.js:137:13)
    at async Route.dispatch (/node_modules/express/lib/router/route.js:112:3)
    at async Layer.handle [as handle_request] (/node_modules/express/lib/router/layer.js:95:5)
    at async /node_modules/express/lib/router/index.js:281:22
    at async Function.process_params (/node_modules/express/lib/router/index.js:335:12)
    at async next (/node_modules/express/lib/router/index.js:275:10)`,
      description: 'Full stack trace with multiple lines'
    },
    {
      title: 'JSON Parse Error',
      message: `SyntaxError: Unexpected token } in JSON at position 245
Input JSON:
{
  "user": {
    "id": 12345,
    "name": "John Doe",
    "email": "john.doe@example.com",
    "roles": ["admin", "user"],
    "settings": {
      "theme": "dark",
      "notifications": true,
      "language": "en",
      }  // <- Error here: extra comma
    }
  }
}

Expected valid JSON format. Please check for:
- Trailing commas
- Missing quotes around strings
- Unclosed brackets or braces
- Invalid escape sequences`,
      description: 'JSON parsing error with context'
    },
    {
      title: 'Database Connection Error',
      message: `Failed to connect to database cluster.

Connection Details:
- Host: db.production.example.com
- Port: 5432
- Database: main_app
- SSL: Required

Error Details:
FATAL: password authentication failed for user "app_user"
DETAIL: Connection matched pg_hba.conf line 92: "host all all 0.0.0.0/0 md5"

Attempted reconnection 5 times with exponential backoff.
Last attempt: ${new Date().toISOString()}

Troubleshooting steps:
1. Verify database credentials in environment variables
2. Check network connectivity to database host
3. Ensure SSL certificates are properly configured
4. Verify user permissions in PostgreSQL
5. Check pg_hba.conf for authentication method

For immediate assistance, contact the database team or check the runbook at:
https://wiki.internal/database-troubleshooting`,
      description: 'Detailed database error with troubleshooting steps'
    },
    {
      title: 'Validation Error',
      message: `Multiple validation errors occurred:

Field: email
  - Value: "not-an-email"
  - Error: Must be a valid email address
  - Pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/

Field: age
  - Value: -5
  - Error: Must be a positive number
  - Range: 0-120

Field: phoneNumber
  - Value: "123"
  - Error: Must be at least 10 digits
  - Format: XXX-XXX-XXXX or (XXX) XXX-XXXX

Field: password
  - Error: Password does not meet requirements:
    ✗ At least 8 characters
    ✗ One uppercase letter
    ✓ One lowercase letter
    ✗ One number
    ✗ One special character (!@#$%^&*)`,
      description: 'Form validation errors with details'
    },
    {
      title: 'API Rate Limit Exceeded',
      message: `HTTP 429 Too Many Requests

You have exceeded the rate limit for this endpoint.

Rate Limit Details:
- Limit: 100 requests per minute
- Current usage: 105 requests
- Reset time: ${new Date(Date.now() + 30000).toISOString()}
- Retry-After: 30 seconds

Request Information:
- Endpoint: POST /api/v2/data/process
- Client IP: 192.168.1.100
- API Key: sk_live_****************************3a4b
- Request ID: req_7HgKm9Lx2Qp4Nv8J

To avoid rate limiting:
- Implement exponential backoff
- Use webhook endpoints for bulk operations
- Cache responses when possible
- Consider upgrading to a higher tier plan`,
      description: 'Rate limiting error with retry information'
    },
    {
      title: 'Memory Allocation Error',
      message: `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory

<--- Last few GCs --->

[2341:0x7f8c3c0]    45123 ms: Mark-sweep 2045.3 (2082.1) -> 2044.2 (2082.1) MB, 678.9 / 0.0 ms  (average mu = 0.122, current mu = 0.012) allocation failure scavenge might not succeed
[2341:0x7f8c3c0]    45834 ms: Mark-sweep 2045.6 (2082.1) -> 2044.8 (2082.6) MB, 701.2 / 0.0 ms  (average mu = 0.069, current mu = 0.013) allocation failure scavenge might not succeed

<--- JS stacktrace --->

==== JS stack trace =========================================

    0: ExitFrame [pc: 0x140dcf9]
    1: StubFrame [pc: 0x1410e9d]
Security context: 0x3d5c08d08d89 <JSObject>
    2: processLargeDataset [0x3d5c3f9c1234] [/app/src/processors/dataProcessor.js:234:15]
    3: /* anonymous */ [0x3d5c3f9c4567] [/app/src/index.js:89:5]

Current memory usage:
- RSS: 2.1 GB
- Heap Total: 2.08 GB
- Heap Used: 2.04 GB
- External: 18.7 MB
- Array Buffers: 9.8 MB

Consider:
- Increasing Node.js memory limit: node --max-old-space-size=4096
- Processing data in smaller chunks
- Using streams for large data sets
- Implementing pagination`,
      description: 'Memory error with heap information'
    }
  ];

  constructor(private messageService: MessageService) {}

  showError(example: { title: string; message: string }): void {
    this.messageService.showError(`${example.title}: ${example.message}`);
  }
}