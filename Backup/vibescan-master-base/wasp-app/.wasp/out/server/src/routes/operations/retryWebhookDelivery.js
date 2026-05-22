import { createAction } from '../../middleware/operations.js'
import retryWebhookDelivery from '../../actions/retryWebhookDelivery.js'

export default createAction(retryWebhookDelivery)
