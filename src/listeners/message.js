require('dotenv').config()
const axios = require('axios')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const urlSafetyDB = deta.Base('domain-reputations')
const serverSettingsDB = deta.Base('server-settings')
const { sendMessage, sendEmbeds } = require('../modules/message')

module.exports = function (client) {
  client.on('messageCreate', async message => {
    // Ignore messages sent by bots
    if (!message.member || message.member.user.bot) return
    const serverConfig = await serverSettingsDB.get(message.guild.id)
    // Same log channel for now
    const channels = await message.guild.channels.fetch()
    const logChannel = channels.get(serverConfig.inviteLogChannel)

    const urlMatches = message.content.match(/\w+:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g) || []

    urlMatches.forEach(async match => {
      // Return if no url or if message can't be deleted
      if (!match || !message.deletable) return
      const url = new URL(match)
      let entry = await urlSafetyDB.get(url.hostname)
      if (!entry) {
        // eslint-disable-next-line
        entry = (await axios({
          url: `https://ipqualityscore.com/api/json/url/${process.env.IPQS_KEY}/${encodeURIComponent(url.hostname)}`
        }).catch(e => sendMessage(logChannel, 'Unabled to scan hostname ' + url.hostname)))?.data
        console.log(`New hostname added to database: ${url.hostname}`)
        urlSafetyDB.put(entry, url.hostname, { expireIn: 2592000 }) // Expire in 1 month
      }
      const { risk_score: riskScore } = entry
      console.log(riskScore)
      let timeoutHours = 24
      const actions = []
      /* eslint-disable no-fallthrough */
      switch (true) {
        case riskScore >= 85: // Longer Timeout, Delete, respond, log
          timeoutHours = 48
        case riskScore >= 75: // Timeout, Delete, respond, log
          message.member.timeout(timeoutHours * 3600 * 1000, 'Posting harmful links')
            .catch(e => console.error('Cannot timeout user', e))
          actions.push('timeout user')
        case riskScore >= 50: // Delete, respond, log
          await message.reply({ content: 'Message was deleted because it contained a harmful link' })
          await message.delete()
          actions.push('delete message')
        case riskScore >= 25: // log
          actions.push('log URL')
          sendEmbeds(logChannel, [{
            color: parseInt('b81414', 16),
            author: { name: message.member.user.username, iconURL: message.member.displayAvatarURL() },
            title: 'Message had a flagged URL',
            description: `Sent by <@!${message.member.id}> in <#${message.channel.id}>\nActions Taken: ${actions.join(', ')}`,
            fields: [
              { name: 'URL', value: `${url.href}`, inline: true },
              { name: 'Risk Score', value: String(riskScore), inline: true }
            ],
            timestamp: Date.now()
          }])
      }
      /* eslint-enable no-fallthrough */
    })
  })
}
