import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { Platform } from 'react-native'
import schema from './schema'
import Report from './models/Report'
import ReportImage from './models/ReportImage'

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'fieldReporting',
  // JSI is auto-installed on iOS; Android uses the async bridge adapter, which needs no extra native setup
  jsi: Platform.OS === 'ios',
  onSetUpError: error => {
    console.error('[WatermelonDB] setup failed', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Report, ReportImage],
})

export { Report, ReportImage }
