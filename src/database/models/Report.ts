import { Model, Query } from '@nozbe/watermelondb'
import { children, date, field, text } from '@nozbe/watermelondb/decorators'
import type ReportImage from './ReportImage'

export type ReportStatus = 'pending' | 'failed'

export default class Report extends Model {
  static table = 'reports'
  static associations = {
    report_images: { type: 'has_many' as const, foreignKey: 'report_id' },
  }

  @text('description') description!: string
  @field('image_count') imageCount!: number
  @field('status') status!: ReportStatus
  @field('error') error!: string | null
  @date('created_at') createdAt!: Date

  @children('report_images') images!: Query<ReportImage>
}
