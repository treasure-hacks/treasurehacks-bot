// eslint-disable-next-line no-unused-vars
const { Message, Events } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { client } = require('../modules/bot-setup')

/**
 * Scans the chat message for harmful or malicious links
 * @param {Message} message The chat message
 */
async function countMessage (message) {
  // Ignore messages sent by bot
  if (!message.member || message.member.user.bot) return
  const serverConfig = await serverSettingsDB.get(message.guild.id)
  if (!serverConfig.messageCounter?.enabled) return

  const ignoredRoles = serverConfig.messageCounter?.ignoredRoles || []
  const actionableUser = !ignoredRoles.some(id => {
    return message.member.roles.cache.map(r => r.id).includes(id)
  })
  if (!actionableUser) return

  const counts = serverConfig.messageCounter.counts
  const userID = message.member.id

  const currentCount = counts[userID] || 0
  counts[userID] = currentCount + 1

  await serverSettingsDB.put(serverConfig)
}

client.on(Events.MessageCreate, countMessage)
