const { SlashCommandBuilder } = require('@discordjs/builders')
const { ChannelType } = require('discord-api-types/v9')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

async function setLog (interaction, client) {
  const channel = interaction.options.getChannel('channel')
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  let embed = {}
  if (channel && !channel.id) {
    embed = {
      title: 'Error in configuration',
      description: 'Unable to find that channel',
      color: 0xff0000
    }
  } else if (!channel) {
    serverConfig.inviteLogChannel = null
    await serverSettingsDB.put(serverConfig)
    embed = {
      title: 'Success',
      description: 'Successfully removed the log channel',
      color: 0x00ff00
    }
  } else {
    serverConfig.inviteLogChannel = channel.id
    serverConfig.logChannel = undefined
    await serverSettingsDB.put(serverConfig)
    embed = {
      title: 'Success',
      description: `Set the log channel to <#${channel.id}>`,
      color: 0x00ff00
    }
  }
  interaction.reply({
    embeds: [embed],
    ephemeral: channel && !channel.id
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure settings related to the Treasure Hacks Bot')
    .addSubcommand(subcommand => {
      subcommand.setName('log').setDescription('Specifies which channel should be used to log info')
        .addChannelOption(option => option
          .setName('channel')
          .setDescription('The channel that should be used to log Treasure Hacks Bot events. Leave blank to disable')
          .addChannelTypes(ChannelType.GuildText)
        )
      return subcommand
    }),
  userPermissions: ['ADMINISTRATOR'],
  defaultMemberPermissions: 8,
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'log': return setLog(interaction, client)
    }
  }
}
