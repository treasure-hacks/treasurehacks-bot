const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()
const { sendMessageAsync } = require('../../../modules/message')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')

/**
 * Creates or edits a bot message
 * @param {express.Request} req The request
 * @param {express.Response} res The response
 * @param {String} guildId The Guild ID
 * @param {String} channelId The channel ID
 * @param {Object} message The message content
 * @param {String} messageId The message ID
 */
async function putMessage (req, res, guildId, channelId, message, messageId = undefined) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildId)?.fetch()
  if (!guild) return res.status(404).send({ error: 'Bot is not in this guild' })
  const channel = await guild.channels.fetch(channelId)
  if (!channel) return res.status(404).send({ error: 'This channel does not exist or the bot cannot access it' })

  if (messageId) {
    // Edit an existing message
    const existingMessage = await channel.messages.fetch(messageId).catch(() => {})
    if (!existingMessage && !req.body.createIfNotFound) {
      return res.status(404).send({ error: 'Message was not found' })
    } else if (existingMessage && existingMessage.author.id !== client.user.id) {
      return res.status(400).send({ error: 'Client and message author do not match' })
    } else if (existingMessage) {
      // If the message with specified ID exists
      let error
      const response = await existingMessage.edit(message).catch(e => { error = e.message })
      res.send(error ? { error } : response)
      return
    }
  }

  try {
    const response = await sendMessageAsync(channel, message)
    res.send(response)
  } catch (e) {
    res.send({ error: e.message })
  }
}

router.post('/post', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    channel: Joi.string().regex(/^\d+$/).required(),
    message: Joi.object().required()
  })
  if (!isValid) return

  const { guild, channel, message } = req.body
  await putMessage(req, res, guild, channel, message)
})

router.put('/edit', validateAPIKey, async (req, res) => {
  const isValid = validateBody(req, res, {
    guild: Joi.string().required(),
    channel: Joi.string().regex(/^\d+$/).required(),
    messageId: Joi.string().required(),
    createIfNotFound: Joi.boolean(),
    message: Joi.object().required()
  })
  if (!isValid) return

  const { guild, channel, message, messageId } = req.body
  await putMessage(req, res, guild, channel, message, messageId)
})

module.exports = router
