const { registerSlashCommands } = require('../modules/bot-setup')

const express = require('express')
const router = express.Router()

router.get('/add-to-server', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${process.env.BOT_CLIENT_ID}&permissions=8&scope=applications.commands%20bot`)
})
router.get('/refresh-commands', async (req, res) => {
  if (req.query.key !== process.env.BOT_API_KEY) return res.send('Incorrect Key')
  const result = await registerSlashCommands()
  res.send(result)
})

module.exports = router
