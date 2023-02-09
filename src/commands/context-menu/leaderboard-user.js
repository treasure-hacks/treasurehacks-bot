// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')

/**
 * Prompts the user for the leaderboard to add the user to
 * @param {UserContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function addToLeaderboard (interaction, client) {
  // Refresh users
  await interaction.guild.members.fetch()

  interaction.showModal({
    title: 'Add User to Leaderboard',
    custom_id: `modal_root_leaderboard_user#${interaction.targetMember.id}`,
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
    }, {
      type: 1,
      custom_id: 'test2',
      components: [{
        type: 4,
        style: 1,
        custom_id: 'modal_txt_leaderboard_amount',
        label: 'Point Amount',
        placeholder: '1',
        required: false
      }]
    }]
  })
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Add to Leaderboard')
    .setType(ApplicationCommandType.User)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: addToLeaderboard
}
