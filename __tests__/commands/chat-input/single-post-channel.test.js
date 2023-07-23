const { Client, PermissionFlagsBits } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { setSPChannel, getSPCStatus, grantSendPermission } = require('../../../src/commands/chat-input/single-post-channel')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1', everyoneRole: { permissions: PermissionFlagsBits.ViewChannel } })
client.guilds.cache.set(guild.id, guild)
const channel = discordMock.createChannel(client, guild, { id: '2', guild, name: 'ch1' })
client.channels.cache.set(channel.id, channel)
guild.channels.cache.set(channel.id, channel)
const user = discordMock.createUser(client, { id: 'u1' })
client.users.cache.set(user.id, user)

jest.spyOn(Client.prototype, 'emit')

describe('Single Post Channel Add Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { channel, channelId: channel.id, guild, guildId: guild.id })
  })
  beforeEach(() => {
    this.interaction.reply.mockClear()
    detaMock.Base.get.mockReturnValue({})
  })

  it('Replies with an error if the channel is already a single-post channel', async () => {
    detaMock.Base.get.mockReturnValueOnce({ singlePostChannels: [channel.id] })
    const expectedReply = { content: 'Channel is already a single-post channel', ephemeral: true }
    await setSPChannel(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies that it added the current channel as a single-post channel', async () => {
    const expectedReply = { content: 'Added <#2> as a single-post channel', ephemeral: true }
    await setSPChannel(this.interaction, client, true)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the DB with the newly added single-post channel ID', async () => {
    const expectedDB = { singlePostChannels: ['2'] }
    await setSPChannel(this.interaction, client, true)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })

  it('Emits an event that Single Post Channels were updated', async () => {
    await setSPChannel(this.interaction, client, true)
    expect(client.emit).toBeCalledWith('*UpdateSinglePostChannels', 'g1', ['2'])
  })
})

describe('Single Post Channel Remove Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { channel, channelId: channel.id, guild, guildId: guild.id })
  })
  beforeEach(() => {
    this.interaction.reply.mockClear()
    detaMock.Base.get.mockReturnValue({})
  })

  it('Replies with an error if the channel is not a single-post channel', async () => {
    const expectedReply = { content: 'Channel is not a single-post channel', ephemeral: true }
    await setSPChannel(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies that the current channel is no longer a single-post channel', async () => {
    detaMock.Base.get.mockReturnValueOnce({ singlePostChannels: [channel.id] })
    const expectedReply = { content: '<#2> is no longer a single-post channel', ephemeral: true }
    await setSPChannel(this.interaction, client, false)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Updates the DB with the newly removed single-post channel ID', async () => {
    detaMock.Base.get.mockReturnValueOnce({ singlePostChannels: [channel.id, '3'] })
    const expectedDB = { singlePostChannels: ['3'] }
    await setSPChannel(this.interaction, client, false)
    expect(detaMock.Base.put).toBeCalledWith(expectedDB)
  })

  it('Emits an event that Single Post Channels were updated', async () => {
    detaMock.Base.get.mockReturnValueOnce({ singlePostChannels: [channel.id, '3'] })
    await setSPChannel(this.interaction, client, false)
    expect(client.emit).toBeCalledWith('*UpdateSinglePostChannels', 'g1', ['3'])
  })
})

describe('Single Post Channel Status Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { channel, channelId: channel.id, guild, guildId: guild.id })
  })
  beforeEach(() => {
    this.interaction.reply.mockClear()
    detaMock.Base.get.mockReturnValue({})
  })

  it('Replies that the channel is single-post when it is marked', async () => {
    detaMock.Base.get.mockReturnValueOnce({ singlePostChannels: [channel.id] })
    const expectedReply = { content: '<#2> currently is a single-post channel', ephemeral: true }
    await getSPCStatus(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies that the channel is not single-post when it is not marked', async () => {
    const expectedReply = { content: '<#2> is currently not a single-post channel', ephemeral: true }
    await getSPCStatus(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })
})

describe('Single Post Channel Grant Permissions Command', () => {
  beforeAll(() => {
    this.interaction = discordMock.createInteraction(client, { channel, channelId: channel.id, guild, guildId: guild.id })
    this.interaction.options.getUser.mockReturnValue(user)
  })
  beforeEach(() => {
    this.interaction.reply.mockClear()
    detaMock.Base.get.mockReturnValue({ singlePostChannels: [channel.id] })
  })

  it('Replies with an error if the channel is not a single-post channel', async () => {
    detaMock.Base.get.mockReturnValueOnce({})
    const expectedReply = { content: 'Channel is not a single-post channel', ephemeral: true }
    await grantSendPermission(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies that the send message permission was granted to the user', async () => {
    const expectedReply = { content: 'Granted send message permission to <@u1>', ephemeral: true }
    await grantSendPermission(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Creates a permission overwrite that allows the user to view the channel and send messages', async () => {
    await grantSendPermission(this.interaction, client)
    expect(channel.permissionOverwrites.create).toBeCalledWith(user.id, { ViewChannel: true, SendMessages: true })
  })
})
