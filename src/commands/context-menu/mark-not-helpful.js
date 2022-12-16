// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')
const { getLogChannel, sendMessage } = require('../../modules/message')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

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
 * Unmarks the post as helpful
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function markNotHelpful (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  if (!serverConfig?.helpfulMessages) serverConfig.helpfulMessages = []

  const msgIndex = serverConfig.helpfulMessages.findIndex(m => {
    return m.id === interaction.targetMessage.id
  })

  if (msgIndex === -1) {
    return interaction.reply({
      content: 'Message was not previously marked as helpful\n' +
        getHelpedTimesText(interaction, serverConfig),
      ephemeral: true
    })
  }

  serverConfig.helpfulMessages.splice(msgIndex, 1)
  await serverSettingsDB.put(serverConfig)
  // Call function again after removing
  const timesText = getHelpedTimesText(interaction, serverConfig)
  interaction.reply({
    content: '⛔️ Message is no longer marked as helpful\n' + timesText,
    ephemeral: true
  })

  const logChannel = await getLogChannel(interaction.guild)
  if (!logChannel) return
  const author = interaction.targetMessage.author
  const truncated = interaction.targetMessage.content.replace(/((?:.*\n){8})(?:.|\n)+/, '$1...')
  sendMessage(logChannel, {
    embeds: [{
      author: {
        name: author.username,
        iconURL: author.displayAvatarURL()
      },
      color: 0xff0000,
      title: 'Message no Longer Marked as Helpful',
      description: truncated +
        `\n\n[Jump to Message](${interaction.targetMessage.url})`,
      fields: [
        { name: 'User', value: author.tag, inline: true },
        { name: 'Helped', value: timesText.match(/\d+ times?/)[0], inline: true }
      ]
    }]
  })
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Mark Not Helpful')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: markNotHelpful
}
