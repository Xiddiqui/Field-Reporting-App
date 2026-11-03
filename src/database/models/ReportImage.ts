import { Model, Relation } from '@nozbe/watermelondb'
import { field, immutableRelation } from '@nozbe/watermelondb/decorators'
import type Report from './Report'
import type { ImageStatus } from '../../delivery/deliveryTypes'

export default class ReportImage extends Model {
  static table = 'report_images'
  static associations = {
    reports: { type: 'belongs_to' as const, key: 'report_id' },
  }

  @field('report_id') reportId!: string
  // Stable UUID; also names the server object, so a re-upload replaces instead of duplicating
  @field('image_id') imageId!: string
  @field('position') position!: number
  // Copy of the picker file kept until processing succeeds (relative to the documents directory)
  @field('original_file_name') originalFileName!: string | null
  // Processed JPEG (relative to the documents directory); empty while processing
  @field('file_name') fileName!: string
  @field('status') status!: ImageStatus
  @field('mime_type') mimeType!: string
  @field('size') size!: number
  @field('width') width!: number
  @field('height') height!: number
  @field('remote_path') remotePath!: string | null
  @field('remote_url') remoteUrl!: string | null

  @immutableRelation('reports', 'report_id') report!: Relation<Report>
}
