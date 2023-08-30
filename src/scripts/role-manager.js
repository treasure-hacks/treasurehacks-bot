const { client } = require('../modules/bot-setup')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const { sendMessage } = require('../modules/message')

async function logRoleAddition (guild, member, role, reason) {
  const serverConfig = await serverSettingsDB.get(guild.id)
  const channels = await guild.channels.fetch()
  const logChannel = channels.get(serverConfig.logChannel)

  sendMessage(logChannel, {
    embeds: [{
      color: parseInt('5a686c', 16),
      author: { name: 'Role Granted via API', iconURL: member.displayAvatarURL() },
      title: '',
      description: `${member} was given the role ${role}`,
      fields: [
        { name: 'User', value: `${member.user.username}#${member.user.discriminator}`, inline: true },
        { name: 'Reason', value: reason, inline: true }
      ],
      timestamp: new Date().toISOString()
    }]
  })
}

async function addToRole (guildID, tag, roleName, reason) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildID)?.fetch()
  if (!guild) return { error: 'Bot is not in this guild' }

  const users = (await guild.members.fetch()).filter(u => !u.user.bot)
  const userMatch = users.find(u => `${u.user.username}#${u.user.discriminator}`.replace(/#0$/, '') === tag)
  const targetRole = (await guild.roles.fetch()).find(r => r.name === roleName)
  if (!userMatch || !targetRole) return { error: 'User or role does not exist in this guild' }

  let failed = false
  const response = await userMatch.roles.add(targetRole).catch(e => { failed = true })
  if (failed) return { error: 'Unable to add role' }
  logRoleAddition(guild, userMatch, targetRole, reason)

  return response
}

async function addMultipleRoles (guildID, tag, roleIDs, reason) {
  const guilds = await client.guilds.fetch()
  const guild = await guilds.get(guildID)?.fetch()
  if (!guild) return { error: 'Bot is not in this guild' }

  const users = (await guild.members.fetch()).filter(u => !u.user.bot)
  const userMatch = users.find(u => `${u.user.username}#${u.user.discriminator}`.replace(/#0$/, '') === tag)
  if (!userMatch) return { error: 'User does not exist in this guild' }

  const targetRoles = (await guild.roles.fetch()).map(r => r) // Maps to their actual values
    .filter(r => roleIDs.includes(r.id))
  const embed = {
    color: parseInt('5a686c', 16),
    author: { name: 'Role Granted via API', iconURL: userMatch.displayAvatarURL() },
    title: '',
    description: '',
    fields: [
      { name: 'User', value: `${userMatch.user.username}#${userMatch.user.discriminator}`, inline: true },
      { name: 'Reason', value: reason, inline: true }
    ],
    timestamp: new Date().toISOString()
  }
  const successfulRoles = []
  const failedRoles = []
  for (const role of targetRoles) {
    let failed = false
    await userMatch.roles.add(role).catch(e => { failed = true })
    if (failed) {
      failedRoles.push(role)
      continue
    }
    successfulRoles.push(role)
  }

  embed.description = `${userMatch} was given the following roles: ${successfulRoles.join(', ') || 'None'}\n` +
    `Failed to add the following roles: ${failedRoles.join(', ') || 'None'}`

  const serverConfig = await serverSettingsDB.get(guild.id)
  const channels = await guild.channels.fetch()
  const logChannel = channels.get(serverConfig.logChannel)

  logChannel.send({ embeds: [embed] })
  return { success: true, added: successfulRoles.map(r => r.id) }
}

module.exports = { addToRole, addMultipleRoles }
