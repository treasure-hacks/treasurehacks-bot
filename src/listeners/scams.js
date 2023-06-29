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
async function scanMessage (message) {
  // Ignore messages sent by bots
  if (!message.member || message.member.user.bot) return
  const serverConfig = await serverSettingsDB.get(message.guild.id)
  if (!serverConfig.cryptoScamScanner?.enabled) return

  const joinedDays = (new Date() - message.member.joinedAt) / 1000 / 3600 / 24
  const minLength = serverConfig.cryptoScamScanner.minLength || 30
  if (message.content != null && message.content.length < minLength) return
  if (joinedDays > serverConfig.cryptoScamScanner.maxDays) return

  const ignoredRoles = serverConfig.cryptoScamScanner?.ignoredRoles || []
  const actionableUser = !ignoredRoles.some(id => {
    return message.member.roles.cache.map(r => r.id).includes(id)
  })

  if (!actionableUser) return
  const channels = await message.guild.channels.fetch()
  const alertsChannel = channels.get(serverConfig.alertsChannel)

  const { result } = await fetch('https://api.treasurehacks.org/ai/check-scam', {
    method: 'POST',
    headers: { 'x-api-key': process.env.API_ACCESS_TOKEN },
    body: message.cleanContent
  }).then(x => x.json()).catch(() => ({}))

  if (!result) return
  console.log('Scam Message Log:', { message: message.cleanContent, minLength })
  alertsChannel.send({
    content: `[BETA] Message was marked as crypto scam.\n${message.url}`,
    embeds: [{
      description: message.cleanContent
    }]
  })
}

client.on(Events.MessageCreate, scanMessage)
