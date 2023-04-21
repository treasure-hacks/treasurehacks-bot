const { client } = require('../../../modules/bot-setup')
const express = require('express')
const router = express.Router()

const { validateAPIKey } = require('../../../modules/api-key-validation')

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

module.exports = router
