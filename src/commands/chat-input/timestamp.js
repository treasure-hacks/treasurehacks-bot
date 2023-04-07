// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ActivityType, TextInputStyle } = require('discord.js')

/**
 * Sets the bot status
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
function generateTimestamp (interaction, client) {
  const time = interaction.options.getString('time')
  const date = new Date(time)
  const timestamp = date.getTime() / 1000
  if (isNaN(timestamp)) {
    interaction.reply({ content: 'Error: Invalid timestamp', ephemeral: true })
    return
  }
  interaction.reply({
    content: `<t:${timestamp}:F>\n\`<t:${timestamp}:F>\`\n\n` +
      `<t:${timestamp}:R>\n\`<t:${timestamp}:R>\``,
    ephemeral: true
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Generates a timestamp')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option
      .setName('time')
      .setDescription('The timestamp to generate (your time zone, MM/DD/YY hh:mm AM/PM)')
      .setRequired(true)
    ),
  execute: async (interaction, client) => {
    generateTimestamp(interaction, client)
  }
}
