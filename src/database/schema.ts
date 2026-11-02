import { appSchema, tableSchema } from '@nozbe/watermelondb'

// Offline upload queue: a report stays here until its images and Firestore doc are on the cloud
export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'reports',
      columns: [
        { name: 'description', type: 'string' },
        { name: 'image_count', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true },
        { name: 'error', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'report_images',
      columns: [
        { name: 'report_id', type: 'string', isIndexed: true },
        { name: 'position', type: 'number' },
        { name: 'file_name', type: 'string' },
        { name: 'size', type: 'number' },
        { name: 'remote_url', type: 'string', isOptional: true },
      ],
    }),
  ],
})
