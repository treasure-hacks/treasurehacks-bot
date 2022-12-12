const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()
const { sendMessageAsync } = require('../../../modules/message')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

router.post('/post', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    channel: Joi.string().regex(/^\d+$/).required(),
    message: Joi.object()
  }, { allowUnknown: true })
  if (!isValid) return
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(req.body.guild)?.fetch()
  if (!guild) return res.status(404).send({ error: 'Bot is not in this guild' })
  const channel = await guild.channels.fetch(req.body.channel)
  if (!channel) return res.status(404).send({ error: 'This channel does not exist or the bot cannot access it' })

  try {
    const message = await sendMessageAsync(channel, req.body.message)
    res.send(message)
  } catch (e) {
    res.send({ error: e.message })
  }
})

module.exports = router
