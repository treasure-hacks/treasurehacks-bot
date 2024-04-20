const { ChannelType } = require('discord.js')
const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()
const Joi = require('joi')

const { validateAPIKey } = require('../../../modules/api-key-validation')
const { searchByID, searchByRecent } = require('../../../modules/members')

router.get('/:guild/user-ids', validateAPIKey, async (req, res) => {
  if (req.query.users == null || !/^([^#]+#\d{4}(,|$))*/.test(req.query.users)) {
    return res.status(400).send({ error: 'Users not specified correctly' })
  }
  const usernames = req.query.users.split(',')

  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(req.params.guild)?.fetch()
  if (!guild) return res.status(404).send({ error: 'Bot is not in this guild' })

  // Refresh members
  const members = await guild.members.fetch()
  const users = members.map(m => {
    const { id, username, discriminator, tag } = m.user
    return { id, username, discriminator, tag, avatarURL: m.user.avatarURL() }
  }).filter(u => usernames.includes(u.tag))

  res.send(users)
})

router.get('/:guild/users', validateAPIKey, async (req, res) => {
  if (req.query.ids == null || !/(\d+(?:,|$))+/.test(req.query.ids)) {
    return res.status(400).send({ error: 'Users not specified correctly' })
  }
  const userIDs = req.query.ids.split(',')

  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(req.params.guild)?.fetch()
  if (!guild) return res.status(404).send({ error: 'Bot is not in this guild' })

  // Refresh members
  const members = await guild.members.fetch()
  await guild.roles.fetch()
  const users = members.map(m => {
    const { id, username, discriminator, tag } = m.user
    const roles = m.roles.cache.map(r => r.name)
    return { id, username, discriminator, tag, avatarURL: m.user.avatarURL(), roles }
  }).filter(u => userIDs.includes(u.id))

  res.send(users)
})

router.get('/:guild/announcements-for', validateAPIKey, async (req, res) => {
  const schema = Joi.object({
    channel: Joi.string().required(),
    before: Joi.string().isoDate().required(),
    after: Joi.string().isoDate().required(),
    suffix: Joi.string().required()
  })
  const { error } = schema.validate(req.query)
  if (error) return res.status(400).send({ error: error.details[0].message })

  const channel = await client.guilds.fetch(req.params.guild)
    .then(async g => await g.channels.fetch(req.query.channel))
    .catch(() => {})
  if (!channel) return res.status(404).send({ error: 'Could not find that announcements channel' })
  if (channel.type !== ChannelType.GuildAnnouncement) {
    return res.status(400).send({ error: 'Channel is not an annnouncements channel' })
  }

  const beforeDate = new Date(req.query.before)
  const afterDate = new Date(req.query.after)
  const limit = 20 // Don't get too many messages at a time
  const messages = await channel.messages.fetch({ limit }).then(c => c.map(m => m))
  let oldest = messages.at(-1)
  while (oldest && oldest.createdTimestamp > afterDate) {
    const olderMessages = await channel.messages.fetch({ before: oldest.id, limit }).then(c => c.map(m => m))
    oldest = olderMessages.at(-1)
    messages.push(...olderMessages)
  }

  const result = messages
    .filter(m => m.createdAt > afterDate && m.createdAt < beforeDate)
    .filter(m => m.cleanContent.endsWith(req.query.suffix))
    .map(m => ({
      timestamp: m.createdAt.toISOString(),
      text: m.cleanContent
        .substring(0, m.cleanContent.length - req.query.suffix.length)
        .trim() // Strip whitespace, which will commonly be before the suffix
    }))

  res.send(result)
})

router.get('/member-test', async (req, res) => {
  const guild = await client.guilds.fetch('957408720088891473')
  const member = (await searchByID(guild, '437808476106784770')) ?? null
  const recent = await searchByRecent(guild, 3)
  res.send({ member, recent })
})

module.exports = router
