import { createAction } from '../../middleware/operations.js'
import generateCveRemediation from '../../actions/generateCveRemediation.js'

export default createAction(generateCveRemediation)
