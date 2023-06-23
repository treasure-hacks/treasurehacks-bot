const { ChannelType, PermissionsBitField } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { clearCategory, syncCategory, teamCategory } = require('../../../src/commands/chat-input/category')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })
client.guilds.cache.set(guild.id, guild)
const category = discordMock.createChannel(client, guild, { id: '1', type: ChannelType.GuildCategory, name: 'cat' })
const channels = [
  discordMock.createChannel(client, guild, { id: '2', parentId: '1', name: 'test-channel' }),
  discordMock.createChannel(client, guild, { id: '3', parentId: '1', name: 'test-channel' }),
  discordMock.createChannel(client, guild, { id: '4', parentId: '1', name: 'test-channel' }),
  discordMock.createChannel(client, guild, { id: '5', parentId: '1', name: 'test-channel' }),
  discordMock.createChannel(client, guild, { id: '6', parentId: 'g1', name: 'dont-delete' }),
  discordMock.createChannel(client, guild, { id: '7', parentId: 'g1', name: 'dont-delete' })
]
const deleteFn = channels[0].delete
guild.channels.cache.set(category.id, category)
client.channels.cache.set(category.id, category)
channels.forEach(c => {
  guild.channels.cache.set(c.id, c)
  client.channels.cache.set(c.id, c)
})

describe('Category Clear Command', () => {
  beforeEach(() => {
    deleteFn.mockClear()
  })

  it('Replies with an embed of channel IDs that it will delete', () => {
    const expectedReply = {
      embeds: [{
        title: 'Clearing Category',
        description: 'Deleting the following categories:\n<#2>\n<#3>\n<#4>\n<#5>'
      }],
      ephemeral: true
    }
    const interaction = discordMock.createInteraction(client, { guild })
    interaction.options.getChannel.mockReturnValueOnce(category)
    clearCategory(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Calls delete once for each channel it is deleting and no more', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    interaction.options.getChannel.mockReturnValueOnce(category)
    clearCategory(interaction, client)
    expect(deleteFn).toBeCalledTimes(4) // 2, 3, 4, 5
  })

  it('Calls delete for every channel, plus one for category if specified', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    interaction.options.getChannel.mockReturnValueOnce(category)
    interaction.options.getBoolean.mockReturnValueOnce(true)
    clearCategory(interaction, client)
    expect(deleteFn).toBeCalledTimes(5) // 2, 3, 4, 5, 1
  })
})

describe('Category Sync Command', () => {
  beforeEach(() => {
    channels[0].lockPermissions.mockClear()
  })

  it('Replies with an embed of channels that it will sync', () => {
    const expectedReply = {
      embeds: [{
        title: 'Synced Category',
        description: 'The following channels should now have the same permissions ' +
          'as `cat`:\n<#2>, <#3>, <#4>, <#5>',
        color: 0x00ffaa
      }],
      ephemeral: true
    }
    const interaction = discordMock.createInteraction(client, { guild })
    interaction.options.getChannel.mockReturnValueOnce(category)
    syncCategory(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Calls lockPermissions once for every channel in the category', () => {
    const interaction = discordMock.createInteraction(client, { guild })
    interaction.options.getChannel.mockReturnValueOnce(category)
    syncCategory(interaction, client)
    expect(channels[0].lockPermissions).toBeCalledTimes(4) // 2, 3, 4, 5
  })
})

function teamChannel (name, members, channelType) {
  return {
    name: name,
    type: channelType,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id, // @everyone
        deny: [parseInt(PermissionsBitField.Flags.ViewChannel)]
      },
      ...members.map(m => ({
        id: m.id,
        allow: [parseInt(PermissionsBitField.Flags.ViewChannel)]
      }))
    ]
  }
}

function getCreateChannelReturns () {
  return guild.channels.create.mock.results
    .map(x => {
      const value = x.value
      value.permissionOverwrites.forEach(o => {
        // Cast BigInts to Ints
        if (o.deny) o.deny = o.deny.map(n => parseInt(n))
        if (o.allow) o.allow = o.allow.map(n => parseInt(n))
      })
      return value
    })
}

describe('Category Teams Command', () => {
  beforeAll(() => {
    this.emptyRole = discordMock.createRole(client, { id: 'r0' }, guild)
    this.role = discordMock.createRole(client, { id: 'r1' }, guild)
    guild.roles.cache.set(this.emptyRole.id, this.emptyRole)
    guild.roles.cache.set(this.role.id, this.role)

    this.members = [...new Array(3)].map((_, i) => {
      const user = discordMock.createUser(client, { id: 'u' + (++i) })
      const member = discordMock.createMember(client, { id: 'm' + i, user }, guild)
      guild.members.cache.set(member.id, member)
      member._roles.push(this.role.id) // also required
      member.roles.cache.set(this.role.id, this.role)
      return member
    })

    this.interaction = discordMock.createInteraction(client, { guild })
    this.interaction.options.getChannel.mockReturnValue(category)

    jest.spyOn(Array.prototype, 'sort').mockImplementation(function () { return this })
  })

  beforeEach(() => {
    this.interaction.reply.mockClear()
    this.interaction.deferReply.mockClear()
    this.interaction.followUp.mockClear()
    guild.channels.create.mockClear()
  })

  afterAll(() => {
    jest.spyOn(Array.prototype, 'sort').mockRestore()
  })

  it('Refreshes the guild\'s members', async () => {
    this.interaction.options.getRole.mockReturnValue(this.emptyRole) // role
    this.interaction.options.getInteger.mockReturnValue(1) // size

    await teamCategory(this.interaction, client)
    expect(guild.members.fetch).toBeCalled()
  })

  it('Replies with error when there are no users in the role', async () => {
    this.interaction.options.getRole.mockReturnValue(this.emptyRole) // role
    this.interaction.options.getInteger.mockReturnValue(1) // size
    const expectedReply = {
      embeds: [{
        title: 'Error',
        description: 'No users in role to divide',
        color: 0xff0000
      }],
      ephemeral: true
    }

    await teamCategory(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Defers the reply when creating channels', async () => {
    this.interaction.options.getRole.mockReturnValue(this.role) // role
    this.interaction.options.getInteger.mockReturnValue(1) // size

    await teamCategory(this.interaction, client)
    expect(this.interaction.deferReply).toBeCalled()
  })

  it('Creates the correct channel types for teams', async () => {
    this.interaction.options.getRole.mockReturnValue(this.role) // role
    this.interaction.options.getInteger.mockReturnValue(1) // size
    guild.channels.create.mockImplementation(x => x) // return the param

    const expectedChannels = {
      text: [
        teamChannel('team-1', [this.members[0]], ChannelType.GuildText),
        teamChannel('team-2', [this.members[1]], ChannelType.GuildText),
        teamChannel('team-3', [this.members[2]], ChannelType.GuildText)
      ],
      voice: [
        teamChannel('team-1', [this.members[0]], ChannelType.GuildVoice),
        teamChannel('team-2', [this.members[1]], ChannelType.GuildVoice),
        teamChannel('team-3', [this.members[2]], ChannelType.GuildVoice)
      ],
      both: [
        teamChannel('team-1', [this.members[0]], ChannelType.GuildText),
        teamChannel('team-1', [this.members[0]], ChannelType.GuildVoice),
        teamChannel('team-2', [this.members[1]], ChannelType.GuildText),
        teamChannel('team-2', [this.members[1]], ChannelType.GuildVoice),
        teamChannel('team-3', [this.members[2]], ChannelType.GuildText),
        teamChannel('team-3', [this.members[2]], ChannelType.GuildVoice)
      ]
    }

    this.interaction.options.getString.mockReturnValue('text') // channelType
    await teamCategory(this.interaction, client)
    expect(getCreateChannelReturns()).toEqual(expectedChannels.text)
    guild.channels.create.mockClear()

    this.interaction.options.getString.mockReturnValue('voice') // channelType
    await teamCategory(this.interaction, client)
    expect(getCreateChannelReturns()).toEqual(expectedChannels.voice)
    guild.channels.create.mockClear()

    this.interaction.options.getString.mockReturnValue('both') // channelType
    await teamCategory(this.interaction, client)
    expect(getCreateChannelReturns()).toEqual(expectedChannels.both)
  })

  it('Responds with the correct embed for channels created', async () => {
    this.interaction.options.getRole.mockReturnValue(this.role) // role
    this.interaction.options.getInteger.mockReturnValue(1) // size
    this.interaction.options.getString.mockReturnValue('both') // channelType
    guild.channels.create.mockImplementation(x => x) // return the param

    const expectedReply = {
      embeds: [{
        title: 'Text and Voice Channels Created Successfully',
        description: 'Successfully created teams for <@&r1>\n\n' +
          'Team 1: <@!u1>\nTeam 2: <@!u2>\nTeam 3: <@!u3>',
        color: 0x00aaff
      }]
    }

    await teamCategory(this.interaction, client)
    expect(this.interaction.followUp).toBeCalledWith(expectedReply)
  })

  it('Splits unevenly-sized groups correctly', async () => {
    this.interaction.options.getRole.mockReturnValue(this.role) // role
    this.interaction.options.getInteger.mockReturnValue(2) // size
    this.interaction.options.getString.mockReturnValue('both') // channelType
    guild.channels.create.mockImplementation(x => x) // return the param

    const expectedReply = {
      embeds: [{
        title: 'Text and Voice Channels Created Successfully',
        description: 'Successfully created teams for <@&r1>\n\n' +
          'Team 1: <@!u1>, <@!u2>\nTeam 2: <@!u3>',
        color: 0x00aaff
      }]
    }

    await teamCategory(this.interaction, client)
    expect(this.interaction.followUp).toBeCalledWith(expectedReply)
  })
})
