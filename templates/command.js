const { SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('name')
    .setDescription('My cool command does this!'),
  execute: async (interaction, client) => {
    return interaction.reply('Hey! you used my command!')
  }
}
