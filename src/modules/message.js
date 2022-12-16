// eslint-disable-next-line no-unused-vars
const { EmbedBuilder, Guild, Channel } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Gets the log channel of the guild
 * @param {Guild} guild The guild to get the log channel of
 * @returns {Promise<Channel>} The guild's log channel
 */
async function getLogChannel (guild) {
  const serverConfig = await serverSettingsDB.get(guild.id)
  const channel = await guild.channels.fetch(serverConfig.logChannel)
  return channel
}

/**
 * Gets the alerts channel of the guild
 * @param {Guild} guild The guild to get the alerts channel of
 * @returns {Promise<Channel>} The guild's alerts channel
 */
async function getAlertsChannel (guild) {
  const serverConfig = await serverSettingsDB.get(guild.id)
  const channel = await guild.channels.fetch(serverConfig.alertsChannel)
  return channel
}

function sendMessage (channel, data) {
  if (!channel) return
  channel.send(data)
    .then(message => console.log(`Sent message: ${message.content}`))
    .catch(console.error)
}

async function sendMessageAsync (channel, data) {
  if (!channel) return
  return await channel.send(data)
}

function sendEmbeds (channel, embedConfigs) {
  if (!channel) return
  const embeds = embedConfigs.map(config => {
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(config.title)
      .setAuthor(config.author)
      .setDescription(config.description)
    if (config.url) embed.setURL(config.url)
    if (config.thumbnail) embed.setThumbnail(config.thumbnail)
    if (config.image) embed.setImage(config.image)
    if (config.timestamp) embed.setTimestamp(config.timestamp)
    if (config.footer) embed.setFooter(config.footer)
    if (config.fields) embed.addFields(...config.fields)

    return embed
  })

  channel.send({ embeds })
}

module.exports = { sendMessage, sendMessageAsync, sendEmbeds, getLogChannel, getAlertsChannel }
