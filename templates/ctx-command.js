// eslint-disable-next-line no-unused-vars
const { ContextMenuCommandBuilder, ApplicationCommandType, MessageContextMenuCommandInteraction, Client, PermissionFlagsBits } = require('discord.js')

/**
 * Responds to a context menu command interaction
 * @param {MessageContextMenuCommandInteraction} interaction The context menu command interaction
 * @param {Client} client The discord bot client
 */
async function respond (interaction, client) {
  interaction.reply('You used a context menu command!')
}

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Mark Helpful')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: respond
}
