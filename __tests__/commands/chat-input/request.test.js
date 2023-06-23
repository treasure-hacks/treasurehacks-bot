const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { makeChannelRequest } = require('../../../src/commands/chat-input/request')

const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: '0' })
client.guilds.cache.set(guild.id, guild)
const category = discordMock.createChannel(guild, { id: '1', type: ChannelType.GuildCategory, name: 'category' })
const channel = discordMock.createChannel(guild, { id: '2', guild, name: 'main' }, client)
guild.channels.cache.set(category.id, category)
guild.channels.cache.set(channel.id, channel)

const user = discordMock.createUser(client, { id: 'u1' })
const member = discordMock.createMember(client, { user, roles: [] }, guild)

describe('Request Channel Command', () => {
  beforeAll(() => {
    this.fields = [
      { name: 'Reason', value: 'help' },
      { name: 'Team Name', value: 'test', inline: true },
      { name: 'Members', value: '<@u1>, <@2>', inline: true }
    ]
    channel.send.mockReturnValue(discordMock.resolveTo())
  })
  beforeEach(() => {
    this.interaction = discordMock.createInteraction(client, { guild, member })
    detaMock.Base.get.mockClear()
    detaMock.Base.get.mockReturnValue({
      alertsChannel: channel.id,
      channelRequest: { enabled: true }
    })
    this.interaction.options.getChannel.mockReturnValue(channel)
    this.interaction.options.getString
      .mockReturnValueOnce('test') // name
      .mockReturnValueOnce('<@2>') // members
      .mockReturnValueOnce('help') // reason
  })

  afterEach(() => {
    detaMock.Base.get.mockReset()
    this.interaction.reply.mockClear()
  })

  it('Replies with an error if channel requests are disabled', async () => {
    detaMock.Base.get.mockReturnValueOnce({ channelRequest: { enabled: false } })
    await makeChannelRequest(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      content: 'Unable to send request because requests have not been enabled',
      ephemeral: true
    })
  })

  it('Replies with an error if there is no alerts channel', async () => {
    detaMock.Base.get.mockReturnValueOnce({ channelRequest: { enabled: true } }) // no alertsChannel
    await makeChannelRequest(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      content: 'Unable to send request due to bad host configuration',
      ephemeral: true
    })
  })

  it('Replies with an embed indicating that the channel request has been sent', async () => {
    this.interaction.guild.channels.fetch.mockReturnValue(channel)
    await makeChannelRequest(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith({
      embeds: [{
        title: 'Private Channel Request Sent',
        color: 0x00ff00,
        fields: this.fields
      }],
      ephemeral: true
    })
  })

  it('Sends a message to the guild\'s alerts channel', async () => {
    this.interaction.guild.channels.fetch.mockReturnValue(channel)
    await makeChannelRequest(this.interaction, client)
    expect(channel.send).toBeCalledWith({
      embeds: [{
        title: 'Incoming Channel Request',
        color: 0x0088ff,
        fields: this.fields
      }],
      components: [{
        type: 1,
        components: [
          { type: 2, label: 'Approve', style: 3, custom_id: 'btn_channel_request_approve' },
          { type: 2, label: 'Rename', style: 3, custom_id: 'btn_channel_request_rename_approve' },
          { type: 2, label: 'Deny', style: 4, custom_id: 'btn_channel_request_deny' }
        ]
      }]
    })
  })
})
