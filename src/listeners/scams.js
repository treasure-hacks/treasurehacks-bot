// eslint-disable-next-line no-unused-vars
const { Message, Events } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

const { client } = require('../modules/bot-setup')

const TIMEOUT_HOURS = 24
const MEMORY_MESSAGE_TTL = 20
/** @type {{ [key: string]: Message[] }} */
const pendingScans = {}
/** @type {{ [key: string]: { message: Message, alert: Message } }} */
const recentScams = {} // so we can associate it with the first message

/**
 * Deletes the first message sent with the scam's content,
 * and updates the alert to reflect that
 * @param {string} key The content of the scam
 * @param {Message[]} messages Repeated messages containing the same content
 */
async function deleteRepeatedScams (key, messages) {
  if (!recentScams[key]) return
  const { message, alert } = recentScams[key]
  message.delete().catch(() => {})
  const embeds = [{
    author: { name: message.member.displayName, icon_url: message.member.displayAvatarURL() },
    description: key
  }]
  messages.forEach(m => m.delete().catch(() => {}))
  if (alert.editedAt) return // already took action
  alert.edit({ embeds, content: '[BETA] Message was marked as crypto scam.\n*(deleted due to repeated messages)*' })
  message.member.timeout(TIMEOUT_HOURS * 3600 * 1000, 'Repeated crypto scams').catch(() => {})
}

async function checkActionable (message, serverConfig, minLength) {
  if (!serverConfig.cryptoScamScanner?.enabled) return false

  const joinedDays = (new Date() - message.member.joinedAt) / 1000 / 3600 / 24
  if (message.content != null && message.content.length < minLength) return false
  if (joinedDays > serverConfig.cryptoScamScanner.maxDays) return false

  const ignoredRoles = serverConfig.cryptoScamScanner?.ignoredRoles || []
  const actionableUser = !ignoredRoles.some(id => {
    return message.member.roles.cache.map(r => r.id).includes(id)
  })

  return actionableUser
}

/**
 * Scans the chat message for harmful or malicious links
 * @param {Message} message The chat message
 */
async function scanMessage (message) {
  // Ignore messages sent by bots
  if (!message.member || message.member.user.bot) return
  const serverConfig = await serverSettingsDB.get(message.guild.id)
  const minLength = serverConfig.cryptoScamScanner.minLength || 30
  if (!checkActionable(message, serverConfig, minLength)) return

  const content = message.cleanContent

  if (recentScams[content]) return deleteRepeatedScams(content, [message]) // Repeated scam
  if (pendingScans[content]?.push(message)) return // Message is pending, it will be handled later
  pendingScans[content] = []

  const channels = await message.guild.channels.fetch()
  const alertsChannel = channels.get(serverConfig.alertsChannel)

  const { result } = await fetch('https://api.treasurehacks.org/ai/check-scam', {
    method: 'POST',
    headers: { 'x-api-key': process.env.API_ACCESS_TOKEN },
    body: content
  }).then(x => x.json()).catch(() => ({}))

  if (!result) return delete pendingScans[content]
  console.log('Scam Message Log:', { message: content, minLength })
  const alert = await alertsChannel.send({
    author: { name: message.member.displayName, icon_url: message.member.displayAvatarURL() },
    content: `[BETA] Message was marked as crypto scam.\n${message.url}`,
    embeds: [{ description: content }]
  })

  // Mark it as a scam temporarily so we can catch repeated instances
  // of the same message in a short amount of time
  recentScams[content] = { message, alert }
  setTimeout(() => { delete recentScams[content] }, MEMORY_MESSAGE_TTL * 1000)
  if (pendingScans[content]?.length) deleteRepeatedScams(content, pendingScans[content])
  delete pendingScans[content]
}

client.on(Events.MessageCreate, scanMessage)
