// eslint-disable-next-line no-unused-vars
const { Message, Events } = require('discord.js')
// const axios = require('axios')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')
// const FormData = require('form-data')

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

  const data = [
    {
      role: 'system',
      content: 'Each user message is provided in its entirety. A crypto scam always consists of the following: ' +
        'first, a scammer saying that they earned or made a certain amount of money either in a short time or from ' +
        'a market of some sort and second, asking the target user to reach out to them. Determine whether the ' +
        'following messages are crypto scams. Respond in 1 word only: "yes" or "no". If the user\'s message is ' +
        'definitely a crypto scam, respond "yes". In all other circumstances (including asking questions ' +
        'about a crypto scam or having insufficient information) respond "no".\n\n'
    },
    { role: 'user', content: message.cleanContent }
  ]
  const fd = new FormData()
  fd.append('chatHistory', JSON.stringify(data))
  const response = await fetch('https://api.deepai.org/chat_response', {
    headers: {
      'api-key': process.env.DEEPAI_KEY,
      origin: 'https://deepai.org',
      referrer: 'https://deepai.org/chat'//,
      // 'Content-Type': 'multipart/form-data; boundary=' + fd.getBoundary()
    },
    body: fd, // .getBuffer().toString(), // fetch does not convert to string automatically
    method: 'POST',
    referrerPolicy: 'same-origin'
  }).then(x => console.log(x) || x.text()).catch((e) => { console.error(e) })
  console.log(response)
  if (!response || !/yes/i.test(response) || response.length > 20) return
  console.log('Scam Message Log:', { response: response, message: message.cleanContent, minLength })
  alertsChannel.send({
    content: `[BETA] Message was marked as crypto scam.\n${message.url}`,
    embeds: [{
      description: message.cleanContent
    }]
  })
}

client.on(Events.MessageCreate, scanMessage)
