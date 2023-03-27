// eslint-disable-next-line no-unused-vars
const { Message, Events } = require('discord.js')
const axios = require('axios')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
const FormData = require('form-data')

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
  if (joinedDays > serverConfig.cryptoScamScanner.maxDays) return

  const ignoredRoles = serverConfig.cryptoScamScanner?.ignoredRoles || []
  const actionableUser = !ignoredRoles.some(id => {
    return message.member.roles.cache.map(r => r.id).includes(id)
  })

  if (!actionableUser) return
  const channels = await message.guild.channels.fetch()
  const alertsChannel = channels.get(serverConfig.alertsChannel)

  const data = [
    {
      role: 'system',
      content: 'A crypto scam always consists of the following: (1) a scammer saying that they earned or made ' +
        'a certain amount of money either in a short time or from a market of some sort and (2) asking the target ' +
        'user to reach out to them. Determine whether the following messages are crypto scams. Provided the entire ' +
        'message, respond in 1 word: "yes" or "no". (If there is insufficient information, respond with "no")'
    },
    { role: 'user', content: message.cleanContent }
  ]
  const fd = new FormData()
  fd.append('chatHistory', JSON.stringify(data))
  const response = await axios.post('https://api.deepai.org/chat_response', fd, {
    headers: {
      'api-key': process.env.DEEPAI_KEY,
      origin: 'https://deepai.org',
      referrer: 'https://deepai.org/chat',
      'Content-Type': 'multipart/form-data; boundary=' + fd._boundary
    },
    referrerPolicy: 'same-origin'
  }).catch((e) => { console.error(e) })
  if (!response?.data || !/yes/i.test(response.data)) return
  alertsChannel.send({ content: `[BETA] Message was marked as crypto scam.\n${message.url}` })
}

client.on(Events.MessageCreate, scanMessage)
