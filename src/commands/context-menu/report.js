// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')

/**
 * Responds to a context menu command interaction
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function respond (interaction, client) {
  // Refresh users
  await interaction.guild.members.fetch()
  const userIsAdmin = interaction.targetMessage.member?.permissions?.has(PermissionFlagsBits.Administrator) || false

  if (userIsAdmin) {
    return interaction.reply({
      content: 'Cannot report an administrator\'s message',
      ephemeral: true
    })
  }

  interaction.showModal({
    title: 'Report Message by ' + interaction.targetMessage.author?.tag,
    custom_id: 'modal_root_report#' + interaction.targetMessage.channelId + '/' + interaction.targetMessage.id,
    components: [{
      type: 1,
      custom_id: 'test',
      components: [{
        type: 4,
        style: 1,
        custom_id: 'modal_txt_report_reason',
        label: 'Reason for Reporting',
        placeholder: 'Spamming',
        min_length: 4,
        max_length: 80,
        required: true
      }]
    }]
  })
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Report Message')
    .setType(ApplicationCommandType.Message),
  execute: respond
}
