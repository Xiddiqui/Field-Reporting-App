import { appSchema, tableSchema } from '@nozbe/watermelondb'

// Durable upload queue. A report row is written before the UI says "saved", and is only
// marked uploaded after the server's canonical response has been validated.
export default appSchema({
  version: 2,
  tables: [
    tableSchema({
      name: 'reports',
      columns: [
        { name: 'client_report_id', type: 'string', isIndexed: true },
        { name: 'description', type: 'string' },
        { name: 'image_count', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'error', type: 'string', isOptional: true }, // v1 only, superseded by last_error_message
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'server_report_id', type: 'string', isOptional: true },
        { name: 'attempt_count', type: 'number' },
        { name: 'consecutive_failures', type: 'number' },
        { name: 'next_attempt_at', type: 'number', isOptional: true },
        { name: 'last_error_code', type: 'string', isOptional: true },
        { name: 'last_error_message', type: 'string', isOptional: true },
        { name: 'lease_expires_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'report_images',
      columns: [
        { name: 'report_id', type: 'string', isIndexed: true },
        { name: 'image_id', type: 'string', isIndexed: true },
        { name: 'position', type: 'number' },
        // Paths are relative to the documents directory, whose absolute path can change between iOS app updates
        { name: 'original_file_name', type: 'string', isOptional: true },
        { name: 'file_name', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'mime_type', type: 'string' },
        { name: 'size', type: 'number' },
        { name: 'width', type: 'number' },
        { name: 'height', type: 'number' },
        { name: 'remote_path', type: 'string', isOptional: true },
        { name: 'remote_url', type: 'string', isOptional: true },
      ],
    }),
  ],
})
