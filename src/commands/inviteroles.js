const { SlashCommandBuilder } = require('@discordjs/builders')
const { Deta } = require('deta')
const { ChannelType } = require('discord-api-types/v9')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

async function addInviteRule (interaction, client, isUpdate) {
  const name = interaction.options.getString('name')
  const description = interaction.options.getString('description') || undefined
  let color = interaction.options.getString('color') || undefined
  if (name.match(/[^0-9a-zA-Z-_]/)) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Name must only be alphanumeric characters, dashes, and underscores'
      }],
      ephemeral: true
    })
    return
  }
  if (color && !color.match(/^#?[0-9a-f]{6}$/i)) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Color must be valid HEX'
      }],
      ephemeral: true
    })
    return
  }
  if (color) color = parseInt(color.replace(/^#/, ''), 16)
  const channels = [interaction.options.getChannel('channel'), interaction.options.getChannel('channel2'), interaction.options.getChannel('channel3')].filter(x => !!x)
  const roles = [interaction.options.getRole('role'), interaction.options.getRole('role2'), interaction.options.getRole('role3')].filter(x => !!x)
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const hasInvalidRoles = roles.some(role => {
    const roleJSON = role.toJSON()
    return roleJSON.name === '@everyone' || roleJSON.managed
  })
  if (hasInvalidRoles) {
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: 'Invalid roles: you cannot assign @everyone or managed roles.'
      }],
      ephemeral: true
    })
  }
  const existingRule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if ((existingRule && !isUpdate) || (!existingRule && isUpdate)) {
    // Force separation of commands because we don't want accidental changes being made
    return interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: `Error while ${isUpdate ? 'updating' : 'creating'} rule \`${name}\``,
        description: isUpdate ? 'Rule does not exist' : 'Rule already exists'
      }],
      ephemeral: true
    })
  }
  let replyContent = ''
  if (existingRule) {
    if (description) existingRule.description = description
    if (color) existingRule.color = color
    existingRule.inviteChannelIds.push(...channels.map(c => c.id))
    existingRule.rolesToAdd.push(...roles.map(r => r.id))
    existingRule.inviteChannelIds = [...new Set(existingRule.inviteChannelIds)]
    existingRule.rolesToAdd = [...new Set(existingRule.rolesToAdd)]
    replyContent = {
      embeds: [{
        title: `Updated \`${name}\``,
        color: existingRule.color,
        description: (existingRule.description ? existingRule.description + '\n\n' : '') +
          `Applies to invites in: ${existingRule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
          `\nPeople invited will have these roles: ${existingRule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}`
      }]
    }
  } else {
    serverConfig.inviteRoles.push({
      name,
      color: color,
      description,
      inviteChannelIds: [...new Set(channels)].map(c => c.id),
      rolesToAdd: [...new Set(roles)].map(r => r.id)
    })
    replyContent = {
      embeds: [{
        title: `Created \`${name}\``,
        color,
        description: (description ? description + '\n\n' : '') +
          `Applies to invites in: ${channels.join(', ')}` +
          `\nPeople invited will have these roles: ${roles.join(', ')}`
      }]
    }
  }
  serverSettingsDB.put(serverConfig)
  interaction.reply(replyContent)
}
async function listTargetedInvites (interaction, client) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const serverInvites = await interaction.guild.invites.fetch()
  const inviteArray = serverInvites.map((invite) => {
    return {
      code: invite.code,
      uses: invite.uses,
      channel: invite.channel.id,
      inviter: invite.inviter
    }
  })
  const channelsWithAssignment = serverConfig.inviteRoles.reduce((previous, current) => previous.concat(current.inviteChannelIds), [])
  const invitesWithAssignment = inviteArray.filter(invite => channelsWithAssignment.includes(invite.channel))
  invitesWithAssignment.forEach(invite => {
    const associatedRoles = serverConfig.inviteRoles
      .filter(rule => rule.inviteChannelIds.includes(invite.channel))
      .map(rule => rule.rolesToAdd)
      .flat()
    Object.assign(invite, { associatedRoles })
  })

  const embeds = [/* {
    color: parseInt('5a686c', 16),
    // author: { name: 'Active Role Assignment' },
    title: 'Active Role Assignment',
    description: ''
  } , */ ...invitesWithAssignment.map(invite => {
      const color = invite.associatedRoles.length > 1 ? parseInt('5a686c', 16) : interaction.guild.roles.cache.get(invite.associatedRoles[0]).color
      return {
        color,
        title: '',
        author: { name: `${invite.inviter.username} (via ${invite.code})`, iconURL: invite.inviter.displayAvatarURL() },
        description: `Invite Channel: <#${invite.channel}>, Uses: ${invite.uses}\nRoles Assigned: ${invite.associatedRoles.map(roleId => `<@&${roleId}>`).join(', ')}`
      }
    })]

  return interaction.reply({
    embeds,
    ephemeral: true
  })
}

function addUpdateCommandOptions (subcommand, requireInitial) {
  return subcommand
    .addStringOption(option => option.setName('name')
      .setDescription('A name for this invite rule')
      .setRequired(true)
    )
    .addChannelOption(option => option.setName('channel')
      .setDescription('The channel for select invites')
      .addChannelTypes([ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildVoice])
      .setRequired(requireInitial)
    )
    .addRoleOption(option => option.setName('role')
      .setDescription('The role you would like to give everyone invited to this channel')
      .setRequired(requireInitial)
    )
    .addStringOption(option => option.setName('description')
      .setDescription('An optional description that describes this invite role assignment rule')
    )
    .addStringOption(option => option.setName('color')
      .setDescription('An optional HEX string to assign a color to this role')
    )
    .addChannelOption(option => option.setName('channel2')
      .setDescription('Another channel for select invites')
      .addChannelTypes([ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildVoice])
    )
    .addChannelOption(option => option.setName('channel3')
      .setDescription('Yet another channel for select invites')
      .addChannelTypes([ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildVoice])
    )
    .addRoleOption(option => option.setName('role2')
      .setDescription('Another role you would like to give everyone invited to this channel')
    )
    .addRoleOption(option => option.setName('role3')
      .setDescription('Yet another role you would like to give everyone invited to this channel')
    )
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteroles')
    .setDescription('Manage roles that are automatically added with invites to certain channels')
    .addSubcommand(subcommand => {
      return subcommand
        .setName('list')
        .setDescription('Get a list of role assignments that occur when someone joins the server')
    })
    .addSubcommand(subcommand => {
      return subcommand
        .setName('details')
        .setDescription('Get details about one role assignment rule')
        .addStringOption(option => option.setName('name').setDescription('The name of the assignment rule'))
    })
    .addSubcommand(subcommand => {
      return subcommand
        .setName('invites')
        .setDescription('Get a list of active invites that will add roles to people who use them')
    })
    .addSubcommand(subcommand => {
      subcommand.setName('add').setDescription('Add a new role given to people invited to a certain channel')
      addUpdateCommandOptions(subcommand, true)
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand.setName('update').setDescription('Add a new role given to people invited to a certain channel')
      addUpdateCommandOptions(subcommand, false)
      return subcommand
    }),
  userPermissions: ['ADMINISTRATOR'],
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'invites': return listTargetedInvites(interaction, client)
      case 'add': return addInviteRule(interaction, client, false)
      case 'update': return addInviteRule(interaction, client, true)
    }
  }
}
