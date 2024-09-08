// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')
const { sendMessage, getLogChannel } = require('../../modules/message')
const { serverSettingsDB } = require('../../modules/database')

/**
 * Gets the "helped times" text
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Object} config The server config
 */
function getHelpedTimesText (interaction, config) {
  const userId = interaction.targetMessage.author.id
  const userHelpCount = config.helpfulMessages.filter(m => m.user === userId).length
  const timesText = userHelpCount === 1 ? 'time' : 'times'
  return `<@!${userId}> has been helped others ${userHelpCount} ${timesText}`
}

/**
 * Adds the post to a list of helpful posts
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Object} config The server config
 */
async function addHelpfulMessage (interaction, config) {
  const author = interaction.targetMessage.author
  config.helpfulMessages.push({
    id: interaction.targetMessage.id,
    channel: interaction.channel.id,
    user: author.id
  })
  await serverSettingsDB.put(config)

  const timesText = getHelpedTimesText(interaction, config)
  await interaction.reply({
    content: '⭐️ Message marked as helpful\n' + timesText,
    ephemeral: true
  })

  const logChannel = await getLogChannel(interaction.guild)
  if (!logChannel) return
  const truncated = interaction.targetMessage.content.replace(/((?:.*\n){8})(?:.|\n)+/, '$1...')
  sendMessage(logChannel, {
    embeds: [{
      author: {
        name: author.username,
        iconURL: author.displayAvatarURL()
      },
      color: 0x00aa00,
      title: 'Message Marked as Helpful',
      description: truncated +
        `\n\n[Jump to Message](${interaction.targetMessage.url})`,
      fields: [
        { name: 'User', value: author.tag, inline: true },
        { name: 'Helped', value: timesText.match(/\d+ times?/)[0], inline: true }
      ]
    }]
  })
}

/**
 * Marks the post as helpful
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function markAsHelpful (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig?.helpfulMessages) serverConfig.helpfulMessages = []

  if (serverConfig.helpfulMessages.find(m => m.id === interaction.targetMessage.id)) {
    // Message was already marked helpful
    await interaction.reply({
      content: 'Message was already marked as helpful\n' +
        getHelpedTimesText(interaction, serverConfig),
      ephemeral: true
    })
  } else {
    addHelpfulMessage(interaction, serverConfig)
  }
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Mark Helpful')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: markAsHelpful
}
