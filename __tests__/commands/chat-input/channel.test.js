const { ChannelType, PermissionFlagsBits } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { archiveChannel, syncChannel } = require('../../../src/commands/chat-input/channel')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1', everyoneRole: { permissions: PermissionFlagsBits.ViewChannel } })
const category = discordMock.createChannel(guild, { id: '1', type: ChannelType.GuildCategory, name: 'cat' })
const channels = [
  discordMock.createChannel(guild, { id: '2', guild, parentId: '1', name: 'test-channel1' }, client),
  discordMock.createChannel(guild, { id: '3', guild, parentId: '1', name: 'test-channel2' }, client),
  discordMock.createChannel(guild, { id: '3a', guild, parentId: '3', name: 'thread', type: ChannelType.PublicThread }, client),
  discordMock.createChannel(guild, { id: '4', guild, parentId: 'g1', name: 'some-channel' }, client)
]
guild.channels.cache.set(category.id, category)
channels.forEach(c => guild.channels.cache.set(c.id, c))

describe('Channel Archive Command', () => {
  beforeAll(() => {
    this.viewable = (id, type, ch, bool = true) => {
      return discordMock.createPermissionOverwrites(client, ch,
        { type, id, [bool ? 'allow' : 'deny']: PermissionFlagsBits.ViewChannel })
    }

    this.user = discordMock.createUser(client, { id: 'u1' })
    this.member = discordMock.createMember(client, { user: this.user }, guild)
    this.admin = discordMock.createRole(client, {
      id: 'admin', guild, permissions: PermissionFlagsBits.Administrator
    })
    guild.roles.cache.set(this.admin.id, this.admin)
    guild.members.cache.set(this.member.id, this.member)
    this.channel = channels[0]
    this.channel.permissionOverwrites.edit.mockClear()
  })

  beforeEach(() => {
    discordMock.interaction.reply.mockReset()
    this.channel.permissionOverwrites.cache.clear()
  })

  it('Replies with an error when permissionOverwrites does not exist', async () => {
    const interaction = discordMock.createInteraction(client, { guild, channelId: '3a' })
    guild.channels.fetch.mockReturnValue(channels[2])
    channels[2].permissionOverwrites = null // simulate a channel without permissionOverwrites
    const expectedReply = { content: 'Error: Cannot change permissions for channel type', ephemeral: true }

    await archiveChannel(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Does not lock permissions if sync is false', async () => {
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: channels[1], channelId: '3'
    })
    guild.channels.fetch.mockReturnValue(channels[1])

    await archiveChannel(interaction, client)
    expect(this.channel.lockPermissions).not.toBeCalled()
  })

  it('Locks permissions if sync is true', async () => {
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: channels[1], channelId: '3'
    })
    guild.channels.fetch.mockReturnValue(channels[1])
    interaction.options.getBoolean.mockReturnValue(true)

    await archiveChannel(interaction, client)
    expect(this.channel.lockPermissions).toBeCalled()
  })

  it('Marks the channel as read-only for all non-admin roles', async () => {
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: this.channel, channelId: '2'
    })
    guild.channels.fetch.mockReturnValue(this.channel)

    this.channel.permissionOverwrites.cache.set(this.member.id, this.viewable(this.member.id, 1, this.channel))
    this.channel.permissionOverwrites.cache.set(guild.id, this.viewable(guild.id, 0, this.channel, false))
    this.channel.permissionOverwrites.cache.set(this.admin.id, this.viewable(this.admin.id, 0, this.channel))
    guild.members.fetch.mockReturnValue(this.member)
    guild.roles.fetch.mockImplementation(id => guild.roles.cache.find(r => r.id === id))

    await archiveChannel(interaction, client)
    const noSending = { SendMessages: false, SendMessagesInThreads: false, CreatePublicThreads: false, CreatePrivateThreads: false }
    expect(this.channel.permissionOverwrites.edit).toBeCalledWith(this.member.id, noSending)
    expect(this.channel.permissionOverwrites.edit).toBeCalledWith(guild.id, noSending) // edit still called
    expect(this.channel.permissionOverwrites.edit).not.toBeCalledWith(this.admin.id, noSending)
  })

  it('Replies with "no changes made" if no roles were denied the ability to send messages', async () => {
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: this.channel, channelId: '2'
    })
    guild.channels.fetch.mockReturnValue(this.channel)

    this.channel.permissionOverwrites.cache.set(guild.id, this.viewable(guild.id, 0, this.channel, false))
    this.channel.permissionOverwrites.cache.set(this.admin.id, this.viewable(this.admin.id, 0, this.channel))
    guild.roles.fetch.mockImplementation(id => guild.roles.cache.find(r => r.id === id))

    await archiveChannel(interaction, client)
    expect(interaction.reply).toBeCalledWith({ content: 'No changes were made', ephemeral: true })
  })

  it('Replies with a message that says whose messaging permission was removed', async () => {
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: this.channel, channelId: '2'
    })
    guild.channels.fetch.mockReturnValue(this.channel)

    this.channel.permissionOverwrites.cache.set(this.member.id, this.viewable(this.member.id, 1, this.channel))
    this.channel.permissionOverwrites.cache.set(guild.id, this.viewable(guild.id, 0, this.channel))
    guild.members.fetch.mockReturnValue(this.member)
    guild.roles.fetch.mockImplementation(id => guild.roles.cache.find(r => r.id === id))

    await archiveChannel(interaction, client)
    expect(interaction.reply).toBeCalledWith({
      content: 'The following users and roles can no longer send messages in this channel: <@u1>, @everyone',
      ephemeral: true
    })
  })

  it('Sends a message indicating that the channel was archived', async () => {
    const user = discordMock.createUser(client, { id: 'actor' }) // person executing the command
    const interaction = discordMock.createInteraction(client, {
      guild, guildId: guild.id, channel: this.channel, channelId: '2', user
    })
    guild.channels.fetch.mockReturnValue(this.channel)
    await archiveChannel(interaction, client)
    expect(this.channel.send).toBeCalledWith({
      embeds: [{ title: '', description: '📁 Channel archived by <@actor>' }]
    })
  })
})

describe('Channel Sync Command', () => {
  it('Refreshes the current channel', async () => {
    const interaction = discordMock.createInteraction(client, { guild, channelId: '3' })
    guild.channels.fetch.mockReturnValue(channels[1])

    await syncChannel(interaction, client)
    expect(guild.channels.fetch).toBeCalledWith(channels[1].id)
  })

  it('Replies with an error when permissionOverwrites does not exist', async () => {
    const interaction = discordMock.createInteraction(client, { guild })
    guild.channels.fetch.mockReturnValue(channels[2])
    channels[2].permissionOverwrites = null // simulate a channel without permissionOverwrites

    interaction.channelId = '3a'
    const expectedReply = { content: 'Error: Cannot change permissions for channel type', ephemeral: true }

    await syncChannel(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Calls lock permissions when syncing permissions', async () => {
    const interaction = discordMock.createInteraction(client, { guild, channelId: '2' })
    guild.channels.fetch.mockReturnValue(channels[0])

    await syncChannel(interaction, client)
    expect(channels[0].lockPermissions).toBeCalled()
  })

  it('Calls lock permissions when syncing permissions', async () => {
    const interaction = discordMock.createInteraction(client, { guild, channelId: '2' })
    guild.channels.fetch.mockReturnValue(channels[0])
    const expectedReply = { content: 'Permissions synced with category', ephemeral: true }

    await syncChannel(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })
})
