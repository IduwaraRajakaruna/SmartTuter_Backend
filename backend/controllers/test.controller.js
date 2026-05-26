// quick health check endpoint for testing
exports.healthCheck = async (req, res) => {
    try {
        return await res.status(200).json({ message: 'API is healthy' });
    } catch (error) {
        console.error('Health check failed:', error);
        return await res.status(500).json({ message: 'API is unhealthy', error: error.message });
    }
};