import { createQuery } from '../../middleware/operations.js'
import getRecentScans from '../../queries/getRecentScans.js'

export default createQuery(getRecentScans)
