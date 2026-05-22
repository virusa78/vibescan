import { createAction } from '../../middleware/operations.js'
import generateReportPDF from '../../actions/generateReportPDF.js'

export default createAction(generateReportPDF)
