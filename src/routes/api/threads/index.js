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
    message: Joi.string(),
    name: Joi.string().required(),
    type: Joi.when('message', {
      is: Joi.string().required(),
      then: Joi.forbidden(),
      otherwise: Joi.string().valid('PublicThread', 'PrivateThread')
    })
  })
  if (!isValid) return

  const { guild, channel: channelID, message: messageID, name } = req.body
  /** @type {Message | null} */
  const channel = await client.guilds.fetch(guild)
    .then(async g => await g.channels.fetch(channelID))
    .catch(() => null)
  if (!channel) return res.status(404).send({ error: 'Channel not found' })
  const message = messageID && await channel.messages.fetch(messageID).catch(() => null)
  if (messageID && !message) return res.status(404).send({ error: 'Message not found' })

  /** @type {GuildTextThreadManager | undefined} */
  const threads = channel.threads
  if (!threads) return res.status(400).send({ error: 'Cannot create threads in this channel type' })

  let thread
  if (message) {
    const existingThread = await threads.fetch(message.id).catch(() => null)
    if (existingThread) return res.status(409).send({ error: 'Message already has a thread' })
    thread = await threads.create({ startMessage: message, name }).catch(() => null)
  } else {
    const type = ChannelType[req.body.type || 'PublicThread']
    thread = await threads.create({ type, name }).catch(() => null)
  }
  res.send(thread?.toJSON())
})

module.exports = router
