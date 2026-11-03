import { Model, Query } from '@nozbe/watermelondb'
import { children, field, text } from '@nozbe/watermelondb/decorators'
import type ReportImage from './ReportImage'
import type { ApiErrorCode, ReportStatus } from '../../delivery/deliveryTypes'

export default class Report extends Model {
  static table = 'reports'
  static associations = {
    report_images: { type: 'has_many' as const, foreignKey: 'report_id' },
  }

  // Stable UUID generated before the first attempt; doubles as the server idempotency key
  @field('client_report_id') clientReportId!: string
  @text('description') description!: string
  @field('image_count') imageCount!: number
  @field('status') status!: ReportStatus
  // Epoch milliseconds, kept as numbers so the repository can compare them in queries
  @field('created_at') createdAt!: number
  @field('updated_at') updatedAt!: number
  @field('server_report_id') serverReportId!: string | null
  @field('attempt_count') attemptCount!: number
  @field('consecutive_failures') consecutiveFailures!: number
  @field('next_attempt_at') nextAttemptAt!: number | null
  @field('last_error_code') lastErrorCode!: ApiErrorCode | null
  @field('last_error_message') lastErrorMessage!: string | null
  @field('lease_expires_at') leaseExpiresAt!: number | null

  @children('report_images') images!: Query<ReportImage>
}
