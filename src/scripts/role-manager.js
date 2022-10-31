const { client } = require('../modules/bot-setup')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const { sendEmbeds } = require('../modules/message')

async function logRoleAddition (guild, member, role, reason) {
  const serverConfig = await serverSettingsDB.get(guild.id)
  const channels = await guild.channels.fetch()
  const logChannel = channels.get(serverConfig.logChannel)

  sendEmbeds(logChannel, [{
    color: parseInt('5a686c', 16),
    author: { name: 'Role Granted via API', iconURL: member.displayAvatarURL() },
    title: '',
    description: `${member} was given the role ${role}`,
    fields: [
      { name: 'User', value: `${member.user.username}#${member.user.discriminator}`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    ],
    timestamp: Date.now()
  }])
}

async function addToRole (guildID, tag, roleName, reason) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildID)?.fetch()
  if (!guild) return { error: 'Bot is not in this guild' }

  const users = (await guild.members.fetch()).filter(u => !u.user.bot)
  const userMatch = users.find(u => `${u.user.username}#${u.user.discriminator}` === tag)
  const targetRole = (await guild.roles.fetch()).find(r => r.name === roleName)
  if (!userMatch || !targetRole) return { error: 'User or role does not exist in this guild' }

  let failed = false
  const response = await userMatch.roles.add(targetRole).catch(e => { failed = true })
  if (failed) return { error: 'Unable to add role' }
  logRoleAddition(guild, userMatch, targetRole, reason)

  return response
}

module.exports = { addToRole }
