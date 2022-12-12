const { EmbedBuilder } = require('discord.js')

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

module.exports = { sendMessage, sendMessageAsync, sendEmbeds }
