// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ActivityType, TextInputStyle } = require('discord.js')

/**
 * Sets the bot status
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
function setBotStatus (interaction, client) {
  const activity = interaction.options.getString('activity') || ''
  const type = interaction.options.getString('type')
  const url = interaction.options.getString('url')

  if (!activity && !url) {
    client.user.setPresence({ activity: null })
  } else if (!type) {
    client.user.setActivity(activity)
  } else {
    client.user.setActivity(activity, { type: ActivityType[type], url })
  }

  interaction.reply({ content: 'Updated bot presence', ephemeral: true })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-status')
    .setDescription('Change the bot\'s status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option => option
      .setName('activity')
      .setDescription('The actvity that the bot should be doing')
    )
    .addStringOption(option => option
      .setName('type')
      .setDescription('The activity type')
      .addChoices({ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' },
        { name: 'Listening', value: 'Listening' }, { name: 'Competing', value: 'Competing' },
        { name: 'Streaming', value: 'Streaming' })
    )
    .addStringOption(option => option
      .setName('url')
      .setDescription('The activity URL')
    ),
  execute: async (interaction, client) => {
    setBotStatus(interaction, client)
  },
  // Expose for tests
  setBotStatus
}
