// eslint-disable-next-line no-unused-vars
const { Client, ChatInputCommandInteraction, PermissionsBitField, ChannelType, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js')

/**
 * Clears a category
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
function clearCategory (interaction, client) {
  const guild = interaction.guild
  const category = interaction.options.getChannel('category')
  const deleteParent = interaction.options.getBoolean('delete')
  const channelList = guild.channels.cache.filter(c => c.parentId === category.id)
  const embed = {
    title: 'Clearing Category',
    description: `Deleting the following categories:\n${channelList.map(c => `<#${c.id}>`).join('\n')}`
  }
  interaction.reply({
    embeds: [embed],
    ephemeral: true
  })
  channelList.forEach(channel => {
    channel.delete()
  })
  if (deleteParent) category.delete()
}

/**
 * Syncs permissions of all channels to a category's permissions
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
function syncCategory (interaction, client) {
  const guild = interaction.guild
  const category = interaction.options.getChannel('category')
  const channelList = guild.channels.cache.filter(c => c.parentId === category.id)
  const embed = {
    title: 'Synced Category',
    description: `The following channels should now have the same permissions as \`${category.name}\`:\n` +
      channelList.map(c => `<#${c.id}>`).join(', '),
    color: 0x00ffaa
  }
  interaction.reply({
    embeds: [embed],
    ephemeral: true
  })
  channelList.forEach(channel => {
    channel.lockPermissions()
  })
}

/**
 * Creates a channel for every "team" within a participating role
 * @param {ChatInputCommandInteraction} interaction The slash command interaction
 * @param {Client} client The discord bot client
 */
async function teamCategory (interaction, client) {
  const category = interaction.options.getChannel('category')
  const role = interaction.options.getRole('role')

  // Refresh Member Roles
  await interaction.guild.members.fetch()
  const members = role?.members?.map(m => m)?.sort((a, b) => Math.random() < 0.5 ? -1 : 1)
  const size = interaction.options.getInteger('size')

  const channelType = interaction.options.getString('channel-type') || 'text'

  if (!members?.length) {
    interaction.reply({
      embeds: [{
        title: 'Error',
        description: 'No users in role to divide',
        color: 0xff0000
      }],
      ephemeral: true
    })
    return
  }
  await interaction.deferReply()

  const teams = members.reduce((array, item, index) => {
    if (index % size === 0) array.push([item])
    else array[array.length - 1].push(item)
    return array
  }, [])

  async function createChannel (name, type, team) {
    return await interaction.guild.channels.create({
      name,
      type,
      parent: category.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id, // @everyone
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        ...team.map(user => {
          return {
            id: user.id,
            allow: [PermissionsBitField.Flags.ViewChannel]
          }
        })
      ]
    })
  }
  teams.forEach(async (team, index) => {
    index += 1
    if (channelType !== 'voice') await createChannel('team-' + index, ChannelType.GuildText, team)
    if (channelType !== 'text') await createChannel('team-' + index, ChannelType.GuildVoice, team)
  })
  const readableType = ({
    text: 'Text',
    voice: 'Voice',
    both: 'Text and Voice'
  })[channelType]

  const embed = {
    title: `${readableType} Channels Created Successfully`,
    description: `Successfully created teams for <@&${role.id}>\n\n` +
      teams.map((team, index) => `Team ${index + 1}: ` + team.map(user => `<@!${user.id}>`).join(', ')).join('\n'),
    color: 0x00aaff
  }
  interaction.followUp({
    embeds: [embed]
  })
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('category')
    .setDescription('Manage categories faster than ever before')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand => {
      subcommand.setName('clear').setDescription('Removes all channels from a certain category')
        .addChannelOption(option => option
          .setName('category')
          .setDescription('The category to remove all channels from')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
        )
        .addBooleanOption(option => option
          .setName('delete')
          .setDescription('Whether you would like to delete the category after clearing all channels')
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('teams').setDescription('Creates teams of a set size from all members in a role and creates a category for each of them')
        .addChannelOption(option => option
          .setName('category')
          .setDescription('The category where these channels should be created')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
        )
        .addRoleOption(option => option
          .setName('role')
          .setDescription('The role you would like to split into teams')
          .setRequired(true)
        )
        .addIntegerOption(option => option
          .setName('size')
          .setDescription('The number of people per team')
          .setRequired(true)
        )
        .addStringOption(option => option
          .setName('channel-type')
          .setDescription('The types of channels to create (defaults to text)')
          .addChoices({ name: 'text', value: 'text' }, { name: 'voice', value: 'voice' }, { name: 'both', value: 'both' })
        )
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('sync').setDescription('Sync permissions for all channels with their respective category')
        .addChannelOption(option => option
          .setName('category')
          .setDescription('The category whose channels you would like to sync')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
        )
      return subcommand
    }),
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'clear': return clearCategory(interaction, client)
      case 'sync': return syncCategory(interaction, client)
      case 'teams': return teamCategory(interaction, client)
    }
  },
  // Expose for tests
  clearCategory,
  syncCategory,
  teamCategory
}
