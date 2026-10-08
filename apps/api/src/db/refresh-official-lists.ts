import { refreshOfficialLists } from '../services/official-refresh.js'

const failures = await refreshOfficialLists()
if (failures.length > 0) process.exitCode = 1
