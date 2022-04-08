const { MessageEmbed } = require('discord.js')

function sendMessage (channel, data) {
  channel.send(data)
    .then(message => console.log(`Sent message: ${message.content}`))
    .catch(console.error)
}
function sendEmbeds (channel, embedConfigs) {
  const embeds = embedConfigs.map(config => {
    const embed = new MessageEmbed()
      .setColor(config.color)
      .setTitle(config.title)
      .setAuthor(config.author.name, config.author.iconURL, config.author.string)
      .setDescription(config.description)
    if (config.url) embed.setURL('https://discord.js.org/')
    if (config.thumbnail) embed.setThumbnail('https://i.imgur.com/AfFp7pu.png')
    if (config.image) embed.setImage('https://i.imgur.com/AfFp7pu.png')
    if (config.timestamp) embed.setTimestamp(...config.fields)
    if (config.footer) embed.setFooter(...config.fields)
    if (config.fields) embed.addFields(...config.fields)

    return embed
  })

  channel.send({ embeds })
}

module.exports = { sendMessage, sendEmbeds }
