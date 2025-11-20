// Health Check Endpoint for Cloud Run
// Add this to your server.js or create a separate routes file

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Readiness check (includes DB connection check)
app.get('/ready', async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }

    // Optional: Check Redis connection if using Redis
    // if (redisClient && !redisClient.isReady) {
    //   throw new Error('Redis not connected');
    // }

    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Liveness check (simple ping)
app.get('/alive', (req, res) => {
  res.status(200).send('OK');
});

// Startup probe (for slow-starting containers)
app.get('/startup', (req, res) => {
  // Check if app has finished initialization
  // For example, check if all required services are loaded
  const isReady = mongoose.connection.readyState === 1;
  
  if (isReady) {
    res.status(200).json({ status: 'started' });
  } else {
    res.status(503).json({ status: 'starting' });
  }
});

/* 
Usage in Cloud Run:

gcloud run services update legal-sahai-backend \
  --region=us-central1 \
  --startup-probe-path=/startup \
  --startup-probe-period=10 \
  --startup-probe-timeout=5 \
  --startup-probe-failure-threshold=3 \
  --liveness-probe-path=/alive \
  --liveness-probe-period=30 \
  --liveness-probe-timeout=5 \
  --liveness-probe-failure-threshold=3

Or add to cloudbuild.yaml deployment step:
  - '--startup-probe-path=/startup'
  - '--liveness-probe-path=/alive'
*/
