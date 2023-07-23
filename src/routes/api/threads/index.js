const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()
const Joi = require('joi')
// eslint-disable-next-line no-unused-vars
const { Message, GuildTextThreadManager, ChannelType } = require('discord.js')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

router.post('/create', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    channel: Joi.string().regex(/^\d+$/).required(),
    message: Joi.string().required(),
    name: Joi.string().required()
  })
  if (!isValid) return

  const { guild, channel, message: messageID, name } = req.body
  /** @type {Message | null} */
  const message = await client.guilds.fetch(guild)
    .then(async g => await g.channels.fetch(channel))
    .then(async c => await c.messages.fetch(messageID))
    .catch(() => null)
  if (!message) return res.status(404).send({ error: 'Message not found' })

  /** @type {GuildTextThreadManager | undefined} */
  const threads = message.channel.threads
  if (!threads) return res.status(400).send({ error: 'Cannot create threads in this channel type' })

  const existingThread = await threads.fetch(message.id).catch(() => null)
  if (existingThread) res.status(409).send({ error: 'Message already has a thread' })

  const thread = await threads.create({ startMessage: message, name }).catch(() => null)
  res.send(thread?.toJSON())
})

module.exports = router
