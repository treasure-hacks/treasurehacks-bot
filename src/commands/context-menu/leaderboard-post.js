// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')

/**
 * Prompts the user to ask which leaderboard to add the message to
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function addToLeaderboard (interaction, client) {
  // Refresh users
  await interaction.guild.members.fetch()

  interaction.showModal({
    title: 'Add Message to Leaderboard',
    custom_id: `modal_root_leaderboard_message#${interaction.targetMessage.id}`,
    components: [{
      type: 1,
      custom_id: 'test',
      components: [{
        type: 4,
        style: 1,
        custom_id: 'modal_txt_leaderboard_name',
        label: 'Leaderboard Name',
        placeholder: 'mostHelpful',
        required: true
      }]
    }]
  })
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Add to Leaderboard')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: addToLeaderboard
}
