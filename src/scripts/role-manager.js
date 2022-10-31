const { client } = require('../modules/bot-setup')

async function addToRole (guildID, tag, roleName) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildID)?.fetch()
  if (!guild) return { error: 'Bot is not in this guild' }

  const users = (await guild.members.fetch()).filter(u => !u.user.bot)
  const userMatch = users.find(u => `${u.user.username}#${u.user.discriminator}` === tag)
  const targetRole = (await guild.roles.fetch()).find(r => r.name === roleName)
  if (!userMatch || !targetRole) return { error: 'User or role does not exist in this guild' }

  let failed = false
  const response = await userMatch.roles.add(targetRole).catch(e => { failed = true })
  return failed ? { error: 'Unable to add role' } : response
}

module.exports = { addToRole }
