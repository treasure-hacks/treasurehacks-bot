const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()
const { sendMessageAsync } = require('../../../modules/message')
const Joi = require('joi')

const { validateBody } = require('../../../modules/api-body-validation')
const { validateAPIKey } = require('../../../modules/api-key-validation')
const { AttachmentBuilder } = require('discord.js')

/**
 * Creates or edits a bot message
 * @param {express.Request} req The request
 * @param {express.Response} res The response
 * @param {String} guildId The Guild ID
 * @param {String} channelId The channel ID
 * @param {String} messageId The message ID
 */
async function getMessage (req, res, guildId, channelId, messageId) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildId)?.fetch()
  if (!guild) {
    res.status(404).send({ error: 'Bot is not in this guild' })
    return false
  }
  const channel = await guild.channels.fetch(channelId)
  if (!channel) {
    res.status(404).send({ error: 'This channel does not exist or the bot cannot access it' })
    return false
  }
  const message = await channel.messages.fetch(messageId).catch(() => {})
  if (!message) res.status(404).send({ error: 'Message not found' })
  return message
}

/**
 * Creates or edits a bot message
 * @param {express.Request} req The request
 * @param {express.Response} res The response
 * @param {String} guildId The Guild ID
 * @param {String} channelId The channel ID
 * @param {Message} message The message content
 * @param {String} messageId The message ID
 */
async function putMessage (req, res, guildId, channelId, message, messageId = undefined) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildId)?.fetch()
  if (!guild) return res.status(404).send({ error: 'Bot is not in this guild' })
  const channel = await guild.channels.fetch(channelId)
  if (!channel) return res.status(404).send({ error: 'This channel does not exist or the bot cannot access it' })

  const filePromises = []
  if (message.embeds?.length > 10) message.embeds.splice(10)
  message.embeds?.forEach(embed => {
    // Allow a query param to not download the images
    if (['false', '0'].includes(req.query.downloadImages)) return

    const images = [
      [embed.thumbnail, 'url'],
      [embed.image, 'url'],
      [embed.author, 'iconURL'],
      [embed.footer, 'iconURL']
    ]
    images.forEach(([obj, prop]) => {
      const imgURL = obj && obj[prop]
      if (!imgURL?.startsWith('https://')) return
      const name = `image${filePromises.length + 1}.png`
      obj[prop] = 'attachment://' + name
      const promise = fetch(imgURL).then(x => x.arrayBuffer())
        .then(buffer => new AttachmentBuilder(Buffer.from(buffer), { name }))
      filePromises.push(promise)
    })
  })
  message.files = await Promise.all(filePromises)

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

router.get('/:guild/:channel/:id', validateAPIKey, async (req, res) => {
  const { guild, channel, id: messageId } = req.params
  const message = await getMessage(req, res, guild, channel, messageId)
  if (!message) return
  res.send(message)
})

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
