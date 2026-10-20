const { query } = require('../config/db');

async function logAction(actionType, tableName, recordId, performedBy = null, details = null) {
    try {
        const detailsJson = details ? JSON.stringify(details) : null;
        await query(
            'INSERT INTO audit_logs (action_type, table_name, record_id, performed_by, details) VALUES (?, ?, ?, ?, ?)',
            [actionType, tableName, recordId, performedBy, detailsJson]
        );
    } catch (error) {
        console.error('[Audit Log Failure]:', error.message);
    }
}

module.exports = {
    logAction
};
