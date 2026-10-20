const { query } = require('../config/db');

// File a safety moderation report
async function createReport(req, res, next) {
    try {
        const reporterId = req.user.user_id;
        const { target_type, target_id, reason, description } = req.body;

        if (!target_type || !target_id || !reason) {
            return res.status(400).json({ success: false, message: 'Target type, ID, and reason are required.' });
        }

        const validReasons = ['spam', 'hate_speech', 'harassment', 'nudity', 'violence', 'false_information', 'other'];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ success: false, message: 'Invalid report reason.' });
        }

        await query(
            `INSERT INTO reports (reporter_id, target_type, target_id, reason, description) 
             VALUES (?, ?, ?, ?, ?)`,
            [reporterId, target_type, target_id, reason, description ? description.trim() : null]
        );

        return res.status(201).json({
            success: true,
            message: 'Thank you for your report. Our safety team will review it.'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createReport
};
