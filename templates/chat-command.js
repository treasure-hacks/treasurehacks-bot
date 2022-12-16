// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

/**
 * Handles the slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function respond (interaction, client) {
  interaction.reply('Hey, you used my command!')
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('name')
    .setDescription('My cool command does this!')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: async (interaction, client) => {
    return respond(interaction, client)
  }
}
