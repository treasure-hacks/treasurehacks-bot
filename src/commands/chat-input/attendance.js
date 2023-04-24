// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js')
const { Deta } = require('deta')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Handles the slash command interaction
 * @param {ChatInputCommandInteraction} interaction The chat input command interaction
 * @param {Client} client The discord bot client
 */
async function recordAttendance (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const channel = client.channels.cache.get(interaction.channel.id)
  const name = new Date().toLocaleDateString() + ' \u2013 ' + interaction.options.getString('name')
  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
    return interaction.reply({ content: 'Error: Is not a voice channel', ephemeral: true })
  }
  serverConfig.attendance = serverConfig.attendance || {}
  await interaction.guild.voiceStates.resolve()
  const voiceStates = interaction.guild.voiceStates.cache.filter(vs => vs.channelId === interaction.channel.id)
  const members = voiceStates.map(vs => vs.member.user.id)
  if (members.length === 0) return interaction.reply({ content: 'Error: No members in voice channel', ephemeral: true })
  serverConfig.attendance[name] = members
  interaction.reply({ content: serverConfig.attendance[name].join(', '), ephemeral: true })
  await serverSettingsDB.put(serverConfig)
}

async function listAttendance (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const replyString = Object.entries(serverConfig.attendance).map(([key, value]) => {
    return `__**${key}:**__ ${value.length}`
  }).join('\n')

  interaction.reply({ content: replyString })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('attendance')
    .setDescription('Attendance for workshops and events')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('list').setDescription('Lists attendance counts for all workshops/events')
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('record').setDescription('Record attendance for current channel')
        .addStringOption(option => option
          .setName('name')
          .setDescription('Name of event')
          .setRequired(true)
        )
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'list': return listAttendance(interaction, client, true)
      case 'record': return recordAttendance(interaction, client, false)
    }
  }
}
