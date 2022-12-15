// eslint-disable-next-line no-unused-vars
const { ChatInputCommandInteraction } = require('discord.js')
const { SlashCommandBuilder } = require('discord.js')
const { Deta } = require('deta')
const { sendMessage } = require('../modules/message')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

/**
 * Gets the feature config reply for the current feature
 * @param {ChatInputCommandInteraction} interaction The interaction created by the user
 * @param {*} client The bot client
 */
async function makeChannelRequest (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const alertsChannelID = serverConfig.alertsChannel
  if (!serverConfig.channelRequest?.enabled) {
    interaction.reply({
      content: 'Unable to send request because requests have not been enabled',
      ephemeral: true
    })
    return
  }
  if (!alertsChannelID) {
    interaction.reply({
      content: 'Unable to send request due to bad host configuration',
      ephemeral: true
    })
    return
  }

  const name = interaction.options.getString('name')
  if (!name.match(/^[a-z0-9-]+$/)) {
    interaction.reply({
      content: 'Name must only contain lowercase letters, numbers, and dashes',
      ephemeral: true
    })
    return
  }

  const members = interaction.options.getString('members')?.split(' ') || []
  if (members.some(c => !c.match(/^<@!?\d+>$/))) {
    interaction.reply({
      content: 'Members were not formatted properly. Please enter member names separated by spaces. ie `@Bob @Alice`',
      ephemeral: true
    })
    return
  }
  members.unshift(interaction.member.toString())
  const uniqueMembers = [...new Set(members)]

  const channels = await interaction.guild.channels.fetch()
  const alertsChannel = channels.get(alertsChannelID)
  const fields = [
    { name: 'Reason', value: interaction.options.getString('reason') },
    { name: 'Team Name', value: name, inline: true },
    { name: 'Members', value: uniqueMembers.join(', '), inline: true }
  ]

  sendMessage(alertsChannel, {
    embeds: [{
      title: 'Incoming Channel Request',
      color: 0x0088ff,
      fields
    }],
    components: [{
      type: 1,
      components: [
        {
          type: 2,
          label: 'Approve',
          style: 3,
          custom_id: 'btn_channel_request_approve'
        },
        {
          type: 2,
          label: 'Deny',
          style: 4,
          custom_id: 'btn_channel_request_deny'
        }
      ]
    }]
  })

  interaction.reply({
    embeds: [{
      title: 'Private Channel Request Sent',
      color: 0x00ff00,
      fields
    }],
    ephemeral: true
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('request')
    .setDescription('Sends a request to create a private chat channel with the server organizers and other members')
    .addStringOption(option => option
      .setName('name')
      .setDescription('The name of the group or project (lowercase letters, numbers, and dashes only)')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('members')
      .setDescription('The group members (with the @), separated by spaces, to include in the private chat channel')
      .setRequired(true)
    )
    .addStringOption(option => option
      .setName('reason')
      .setDescription('The reason you are requesting the group, or the question that you have to ask privately.')
      .setRequired(true)
    ),
  // .addSubcommand(subcommand => {
  //   subcommand.setName('link-scanner').setDescription('Configure automatic malware and scam link removal')
  //     .addBooleanOption(option => option
  //       .setName('enabled')
  //       .setDescription('Whether to enable automatic malware and scam link removal')
  //     )
  //   return subcommand
  // }),
  // userPermissions: ['ADMINISTRATOR'],
  // defaultMemberPermissions: 8,
  execute: async (interaction, client) => {
    makeChannelRequest(interaction, client)
  }
}