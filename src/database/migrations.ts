import { addColumns, schemaMigrations, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      // v1 only knew 'pending'/'failed'. Existing rows are carried over rather than dropped:
      // the row id becomes the idempotency key and failed reports wait for a manual retry.
      toVersion: 2,
      steps: [
        addColumns({
          table: 'reports',
          columns: [
            { name: 'client_report_id', type: 'string', isIndexed: true },
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
        addColumns({
          table: 'report_images',
          columns: [
            { name: 'image_id', type: 'string', isIndexed: true },
            { name: 'original_file_name', type: 'string', isOptional: true },
            { name: 'status', type: 'string' },
            { name: 'mime_type', type: 'string' },
            { name: 'width', type: 'number' },
            { name: 'height', type: 'number' },
            { name: 'remote_path', type: 'string', isOptional: true },
          ],
        }),
        unsafeExecuteSql(`
          UPDATE reports SET
            client_report_id = id,
            updated_at = created_at,
            status = CASE status WHEN 'failed' THEN 'needs_attention' ELSE 'queued' END,
            last_error_code = CASE status WHEN 'failed' THEN 'unknown' ELSE NULL END,
            last_error_message = error;
          UPDATE report_images SET
            image_id = id,
            status = 'ready',
            mime_type = 'image/jpeg',
            remote_url = NULL;
        `),
      ],
    },
  ],
})
