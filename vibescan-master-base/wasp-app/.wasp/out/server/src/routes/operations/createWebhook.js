import { createAction } from '../../middleware/operations.js'
import createWebhook from '../../actions/createWebhook.js'

export default createAction(createWebhook)
