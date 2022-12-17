// eslint-disable-next-line no-unused-vars
const { ModalSubmitInteraction } = require('discord.js')
const { getAlertsChannel, sendMessageAsync } = require('../modules/message')

/**
 * Replies to a button click
 * @param {ModalSubmitInteraction} interaction The button interaction
 */
async function replyToReport (interaction) {
  const alertsChannel = await getAlertsChannel(interaction.guild)
  const messageURL = `https://discord.com/channels/${interaction.guild.id}/${interaction.extension}`
  const [channelID, messageID] = interaction.extension.split('/')
  const channel = await interaction.guild.channels.fetch(channelID)
  const message = await channel.messages.fetch(messageID)

  // Force throw error with unknown method if channel doesn't exist
  sendMessageAsync(alertsChannel || {}, {
    embeds: [{
      color: 0xdd6600,
      author: {
        name: interaction.member.user.tag,
        iconURL: interaction.member.user.displayAvatarURL()
      },
      title: 'Reported a Message',
      description: message.content.replace(/((?:.*\n){8})(?:.|\n)+/, '$1...'),
      fields: [
        { name: 'Message Author', value: `${message.author}`, inline: true },
        { name: 'Link', value: `[#${channel.name}](${messageURL})`, inline: true },
        { name: 'Report Reason', value: interaction.fields.getTextInputValue('modal_txt_report_reason') }
      ]
    }]
  }).then(() => {
    interaction.reply({
      content: 'Report Received',
      ephemeral: true
    })
  }).catch(e => {
    console.error(e)
    interaction.reply({
      content: 'Report could not be sent',
      ephemeral: true
    })
  })
}

module.exports = [
  { name: 'modal_root_report', handler: replyToReport }
]
