function validateAPIKey (req, res, next) {
  const inQuery = req.query.key === process.env.BOT_API_KEY
  const inToken = req.headers['api-token'] === process.env.BOT_API_KEY
  if (!inQuery && !inToken) return res.send('Incorrect API Key')
  next()
}

module.exports = { validateAPIKey }
