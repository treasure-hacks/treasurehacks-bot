const { ChannelType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../.jest/mock-discord')
const detaMock = require('../.jest/mock-deta')
// Command Imports must come after mocks
const { recordAttendance } = require('../src/commands/chat-input/attendance')
const { createDefaultSettings } = require('../src/listeners/config')

function createVoiceState (channel) {
  return {
    member: { user: { id: 'user-1' }, toString: function () { return `<@${this.user.id}>` } },
    channelId: channel.id
  }
}

const today = new Date().toLocaleDateString()
const client = discordMock.createClient({}, [])
const guild = discordMock.createGuild(client, { id: 'g1' })

describe('Attendance Record Command', () => {
  it('Replies with error if the current channel is a voice channel', async () => {
    const expectedReply = { content: 'Error: Is not a voice channel', ephemeral: true }
    const channel = discordMock.createChannel(guild, { type: ChannelType.GuildText })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })

    await recordAttendance(interaction, client)
    expect(discordMock.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Refreshes the guild', async () => {
    const channel = discordMock.createChannel(guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
  })

  it('Replies with error if voice channel is empty', async () => {
    const expectedReply = { content: 'Error: No members in voice channel', ephemeral: true }
    const channel = discordMock.createChannel(guild, { type: ChannelType.GuildStageVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(discordMock.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with attendance recorded message', async () => {
    const expectedReply = {
      content: `Recorded attendance for ${today} \u2013 name: <@user-1>` +
      '\n\n`<@user-1>`',
      ephemeral: true
    }
    const channel = discordMock.createChannel(guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    guild.voiceStates.cache.set('1', createVoiceState(channel))

    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(discordMock.interaction.reply).toBeCalledWith(expectedReply)
  })

  it('Replies with attendance recorded message', async () => {
    const expectedConfig = createDefaultSettings(guild)
    const channel = discordMock.createChannel(guild, { type: ChannelType.GuildVoice })
    client.channels.cache.set(channel.id, channel)
    const interaction = discordMock.createInteraction(client, { guild, channel })
    expectedConfig.attendance = { [today + ' \u2013 name']: ['user-1'] }

    guild.voiceStates.cache.set('1', createVoiceState(channel))
    await recordAttendance(interaction, client)
    expect(guild.fetch).toBeCalled()
    expect(detaMock.Base.put).toBeCalledWith(expectedConfig)
  })
})
