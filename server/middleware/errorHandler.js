function errorHandler(err, req, res, next) {
    console.error('Unhandled Application Error:', err);

    // Multer file size limit exceeded
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'Uploaded file exceeds the maximum allowed size limit.'
        });
    }

    // MySQL Duplicate Entry (e.g. unique username, email, or composite like)
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            message: 'A record with this identifier already exists.'
        });
    }

    // MySQL Foreign Key Constraint failure
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            success: false,
            message: 'Referenced entity does not exist.'
        });
    }

    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected internal server error occurred.';

    res.status(statusCode).json({
        success: false,
        message: message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

module.exports = errorHandler;
