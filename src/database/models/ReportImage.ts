import { Model, Relation } from '@nozbe/watermelondb'
import { field, immutableRelation } from '@nozbe/watermelondb/decorators'
import type Report from './Report'

export default class ReportImage extends Model {
  static table = 'report_images'
  static associations = {
    reports: { type: 'belongs_to' as const, key: 'report_id' },
  }

  @field('report_id') reportId!: string
  @field('position') position!: number
  // Stored relative to the documents directory, whose absolute path can change between iOS app updates
  @field('file_name') fileName!: string
  @field('size') size!: number
  @field('remote_url') remoteUrl!: string | null

  @immutableRelation('reports', 'report_id') report!: Relation<Report>
}
