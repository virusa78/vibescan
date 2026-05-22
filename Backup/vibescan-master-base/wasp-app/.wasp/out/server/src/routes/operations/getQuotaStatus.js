import { createQuery } from '../../middleware/operations.js'
import getQuotaStatus from '../../queries/getQuotaStatus.js'

export default createQuery(getQuotaStatus)
