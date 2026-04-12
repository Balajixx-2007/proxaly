let sentry = null

function initMonitoring() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    sentry = require('@sentry/node')
    sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    })
    console.log('Sentry monitoring initialized')
  } catch (err) {
    console.error(`Failed to initialize Sentry: ${err.message}`)
  }
}

function captureException(err, context = {}) {
  if (!err) return
  if (sentry) {
    sentry.captureException(err, context)
  }
}

module.exports = {
  initMonitoring,
  captureException,
}
