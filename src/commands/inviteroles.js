const { SlashCommandBuilder } = require('@discordjs/builders')
const { Deta } = require('deta')
// const { ChannelType } = require('discord-api-types/v9')
const deta = Deta(process.env.DETA_PROJECT_KEY)
const serverSettingsDB = deta.Base('server-settings')

function getChannelsAndRoles (interaction) {
  const channels = interaction.options.getString('channels')?.split(' ') || []
  const roles = interaction.options.getString('roles')?.split(' ') || []

  if (channels.some(c => !c.match(/^<#\d+>$/))) return { error: 'Channels are not formatted properly. Please enter channel names, separated by spaces. ie `#welcome #general`' }
  if (roles.some(c => !c.match(/^<@&\d+>$/))) return { error: 'Roles are not formatted properly. Please enter channel names, separated by spaces. ie `@Group @Lobby`' }

  function isValidRole (role) {
    return !role.managed && role.name !== '@everyone'
  }
  const warnings = channels.filter(channel => {
    return !interaction.guild.channels.cache.find(c => c.toString() === channel)
  }).concat(roles.filter(role => {
    return !interaction.guild.roles.cache.find(r => r.toString() === role && isValidRole(role))
  }))

  const serverData = {
    channels: interaction.guild.channels.cache.filter(channel => {
      return channels.includes(channel.toString())
    }),
    roles: interaction.guild.roles.cache.filter(role => {
      return roles.includes(role.toString())
    }),
    warnings: warnings.length ? ['Could not find the following channels or roles: ' + warnings.join(', ')] : []
  }
  console.trace(serverData)

  return serverData
}

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
  // const channels = [interaction.options.getChannel('channel'), interaction.options.getChannel('channel2'), interaction.options.getChannel('channel3')].filter(x => !!x)
  // const roles = [interaction.options.getRole('role'), interaction.options.getRole('role2'), interaction.options.getRole('role3')].filter(x => !!x)

  const { error, channels, roles, warnings } = getChannelsAndRoles(interaction)
  console.trace(channels)
  const noFieldsInNew = (!channels.size || !roles.size) && !isUpdate
  if (error || noFieldsInNew) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: error || 'There must be at least one valid channel and one valid role'
      }],
      ephemeral: true
    })
    return
  }

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
  console.trace('check existing Rule')
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
  const replyContent = {
    embeds: [],
    ephemeral: true
  }
  if (warnings.length) {
    replyContent.embeds.push({
      color: 0xf0b800,
      title: 'Warnings',
      description: warnings.join('\n')
    })
  }

  if (existingRule) {
    if (description) existingRule.description = description
    if (color) existingRule.color = color
    existingRule.inviteChannelIds.push(...channels.map(c => c.id))
    existingRule.rolesToAdd.push(...roles.map(r => r.id))
    existingRule.inviteChannelIds = [...new Set(existingRule.inviteChannelIds)]
    existingRule.rolesToAdd = [...new Set(existingRule.rolesToAdd)]
    replyContent.embeds.push({
      title: `Updated \`${name}\``,
      color: existingRule.color,
      description: (existingRule.description ? existingRule.description + '\n\n' : '') +
        `Applies to invites in: ${existingRule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${existingRule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}`
    })
  } else {
    serverConfig.inviteRoles.push({
      name,
      color: color,
      description,
      inviteChannelIds: [...new Set(channels)].map(c => c.id),
      rolesToAdd: [...new Set(roles)].map(r => r.id)
    })
    replyContent.embeds.push({
      title: `Created \`${name}\``,
      color,
      description: (description ? description + '\n\n' : '') +
        `Applies to invites in: ${channels.join(', ')}` +
        `\nPeople invited will have these roles: ${roles.join(', ')}`
    })
  }

  serverSettingsDB.put(serverConfig)
  interaction.reply(replyContent)
}
async function listInviteRoles (interaction, client, listAll) {
  const serverConfig = await serverSettingsDB.get(interaction.guild.id)
  const embeds = serverConfig.inviteRoles.filter(rule => {
    return rule.name === interaction.options.getString('name') || listAll
  }).map(rule => {
    return {
      title: `Invite Role Assignment: ${rule.name}`,
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}`
    }
  })

  if (!embeds.length) {
    embeds.push({
      title: listAll
        ? 'Command Failed: No Invite Role Assignments'
        : 'Command Failed: No Matching Rule',
      description: listAll
        ? 'Your server does not have any invite role assignment rules associated with it.\nTry adding one with the `/inviteroles add` command!'
        : 'There was no invite role assignment rule with the name that was provided'
    })
  }

  return interaction.reply({
    embeds,
    ephemeral: true
  })
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

  const embeds = invitesWithAssignment.map(invite => {
    const color = invite.associatedRoles.length > 1 ? parseInt('5a686c', 16) : interaction.guild.roles.cache.get(invite.associatedRoles[0]).color
    return {
      color,
      title: '',
      author: { name: `${invite.inviter.username} (via ${invite.code})`, iconURL: invite.inviter.displayAvatarURL() },
      description: `Invite Channel: <#${invite.channel}>, Uses: ${invite.uses}\nRoles Assigned: ${invite.associatedRoles.map(roleId => `<@&${roleId}>`).join(', ')}`
    }
  })

  return interaction.reply({
    embeds,
    ephemeral: true
  })
}
async function removeInviteRule (interaction, client) {
  const name = interaction.options.getString('name')
  const [removeDescription, removeColor] = [interaction.options.getBoolean('description'), interaction.options.getBoolean('color')]

  const { error, channels, roles, warnings } = getChannelsAndRoles(interaction)
  if (error) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Invalid Arguments',
        description: error
      }],
      ephemeral: true
    })
    return
  }

  const serverConfig = await serverSettingsDB.get(interaction.guild.id)

  const rule = serverConfig.inviteRoles.find(rule => rule.name === name)
  if (!rule) {
    interaction.reply({
      embeds: [{
        color: 0xff0000,
        title: 'Unable to delete ' + name,
        description: 'This invite role assignment rule does not exist'
      }],
      ephemeral: true
    })
    return
  }

  if (removeDescription) delete rule.description
  if (removeColor) delete rule.color
  channels.forEach(channel => {
    const updated = rule.inviteChannelIds.filter(c => c !== channel.id)
    if (updated.length === 0) return warnings.push('Rule must still contain at least one channel. Channel modifications have been ignored.')
    rule.inviteChannelIds = updated
  })
  roles.forEach(role => {
    const updated = rule.rolesToAdd.filter(r => r !== role.id)
    if (updated.length === 0) return warnings.push('Rule must still contain at least one role. Role modifications have been ignored.')
    rule.rolesToAdd = updated
  })

  const replyContent = {
    embeds: [],
    ephemeral: true
  }
  if (warnings.length) {
    replyContent.embeds.push({
      color: 0xf0b800,
      title: 'Warnings',
      description: warnings.join('\n')
    })
  }

  if (!roles.size && !channels.size && removeDescription == null && removeColor == null) {
    // Delete the entire rule
    replyContent.embeds.push({
      title: `Deleted \`${name}\``,
      thumbnail: { url: 'https://files.catbox.moe/y2ev8v.png' },
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}`
    })
    const updated = serverConfig.inviteRoles.filter(r => r !== rule)
    await serverSettingsDB.put(Object.assign(serverConfig, { inviteRoles: updated }))
  } else {
    replyContent.embeds.push({
      title: `Updated \`${name}\``,
      color: rule.color,
      description: (rule.description ? rule.description + '\n\n' : '') +
        `Applies to invites in: ${rule.inviteChannelIds.map(id => `<#${id}>`).join(', ')}` +
        `\nPeople invited will have these roles: ${rule.rolesToAdd.map(role => `<@&${role}>`).join(', ')}`
    })
    await serverSettingsDB.put(serverConfig)
  }

  interaction.reply(replyContent)
}

function addUpdateCommandOptions (subcommand, requireInitial) {
  return subcommand
    .addStringOption(option => option.setName('name').setDescription('The name of your new invite role assignment rule').setRequired(true))
    .addStringOption(option => option.setName('channels').setDescription('The channel for select invites (with the #), separated by spaces').setRequired(requireInitial))
    .addStringOption(option => option.setName('roles').setDescription('Roles (with the @), separated by spaces, to grant to people who are invited to this channel').setRequired(requireInitial))
    .addStringOption(option => option.setName('description').setDescription('A description that describes this invite role assignment rule'))
    .addStringOption(option => option.setName('color').setDescription('A HEX string to assign a color to this role'))
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
        .addStringOption(option => option.setName('name').setDescription('The name of the assignment rule').setRequired(true))
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
      subcommand.setName('update').setDescription('Edit an invite role assignment rule')
      addUpdateCommandOptions(subcommand, false)
      return subcommand
    })
    .addSubcommand(subcommand => {
      subcommand
        .setName('remove')
        .setDescription('Remove linked channels or roles, or, if all params left blank, delete an entire invite role.')
        .addStringOption(option => option.setName('name').setDescription('The name of the rule you want to edit or delete').setRequired(true))
        .addStringOption(option => option.setName('channels').setDescription('Channels (with the #), separated by spaces, to remove from the specified rule'))
        .addStringOption(option => option.setName('roles').setDescription('Roles (with the @), separated by spaces, to remove from the specified rule'))
        .addBooleanOption(option => option.setName('description').setDescription('Whether to remove the description from the specifed rule'))
        .addBooleanOption(option => option.setName('color').setDescription('Whether to remove the color from the specified rule'))
      return subcommand
    }),
  userPermissions: ['ADMINISTRATOR'],
  execute: async (interaction, client) => {
    switch (interaction.options.getSubcommand()) {
      case 'list': return listInviteRoles(interaction, client, true)
      case 'details': return listInviteRoles(interaction, client, false)
      case 'invites': return listTargetedInvites(interaction, client)
      case 'add': return addInviteRule(interaction, client, false)
      case 'update': return addInviteRule(interaction, client, true)
      case 'remove': return removeInviteRule(interaction, client)
    }
  }
}
