const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
const detaMock = require('../../../.jest/mock-deta')
// Command Imports must come after mocks
const { recordAttendance, listAttendance } = require('../../../src/commands/chat-input/attendance')
const { createDefaultSettings } = require('../../../src/listeners/config')

function createVoiceState (channel) {
  return {
    member: { user: { id: 'user-1' }, toString: function () { return `<@${this.user.id}>` } },
    channelId: channel.id
  }
}

const today = new Date().toLocaleDateString()
const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })
client.guilds.cache.set(guild.id, guild)

describe('Attendance Record Command', () => {
  it('Replies with error if the current channel is not a voice channel', async () => {
    const expectedReply = { content: 'Error: Is not a voice channel', ephemeral: true }
    const channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildText })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    await recordAttendance(interaction, client)
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Refreshes the guild', async () => {
    const channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    interaction.options.getString.mockReturnValue('name')

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
  })

  it('Replies with error if voice channel is empty', async () => {
    const expectedReply = { content: 'Error: No members in voice channel', ephemeral: true }
    const channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildStageVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    interaction.options.getString.mockReturnValue('name')

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with attendance recorded message', async () => {
    const expectedReply = {
      content: `Recorded attendance for ${today} \u2013 name: <@user-1>` +
      '\n\n`<@user-1>`',
      ephemeral: true
    }
    const channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    interaction.options.getString.mockReturnValue('name')
    guild.voiceStates.cache.set('1', createVoiceState(channel))

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with attendance recorded message', async () => {
    const expectedConfig = createDefaultSettings(guild)
    const channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    interaction.options.getString.mockReturnValue('name')
    expectedConfig.attendance = { [today + ' \u2013 name']: ['user-1'] }

    guild.voiceStates.cache.set('1', createVoiceState(channel))
    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(detaMock.serverSettingsDB.put).toBeCalledWith(expectedConfig)
  })
})

describe('Attendance List Command', () => {
  beforeEach(() => {
    this.channel = discordMock.createChannel(client, guild, { type: ChannelType.GuildVoice })
    this.interaction = discordMock.createInteraction(client, { guild, channel: this.channel })
  })

  it('Replies with an error when server attendance does not exist', async () => {
    const expectedReply = { content: 'Error: Nothing to take attendance for', ephemeral: true }
    await listAttendance(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)

    const config = createDefaultSettings(guild)
    config.attendance = {} // Exists, but no events
    detaMock.serverSettingsDB.get.mockReturnValue(config)

    await listAttendance(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with the correct counts when events exist', async () => {
    const config = createDefaultSettings(guild)
    config.attendance = { [today + ' \u2013 name']: ['user-id', 'u2'], 'Bad name': [] }
    detaMock.serverSettingsDB.get.mockReturnValue(config)
    const expectedReply = { content: `__**${today} \u2013 name:**__ 2\n__**Bad name:**__ 0` }

    await listAttendance(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expectedReply)

    config.attendance = { 'Empty Only': [] }
    detaMock.serverSettingsDB.get.mockReturnValue(config)
    const expected2 = { content: '__**Empty Only:**__ 0' }

    await listAttendance(this.interaction, client)
    expect(this.interaction.reply).toBeCalledWith(expected2)
  })
})
