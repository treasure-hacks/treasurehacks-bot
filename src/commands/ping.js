const { SlashCommandBuilder } = require('@discordjs/builders')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Get the bot\'s latency!'),
  userPermissions: [],
  defaultPermission: true,
  execute: async (interaction, client) => {
    return interaction.reply({
      content: `Pong \`${client.ws.ping}ms\` 🏓`,
      ephemeral: true
    })
  }
}
