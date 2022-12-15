const { SlashCommandBuilder } = require('discord.js')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get the bot\'s latency!'),
  execute: async (interaction, client) => {
    return interaction.reply({
      content: `Pong \`${client.ws.ping}ms\` 🏓`,
      ephemeral: true
    })
  }
}
