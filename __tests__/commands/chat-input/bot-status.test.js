const { ActivityType } = require('discord.js')
// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { setBotStatus } = require('../../../src/commands/chat-input/bot-status')

const client = discordMock.createClient({}, [])

describe('Set Bot Status Command', () => {
  it('Removes presence when options are null', () => {
    const interaction = discordMock.createInteraction(client)
    interaction.options.getString.mockReturnValue(null)
    setBotStatus(interaction, client)
    expect(client.user.setPresence).toBeCalledWith({ activity: null })
  })

  it('Sets "playing" status to the provided string if a type is not given', () => {
    const interaction = discordMock.createInteraction(client)
    interaction.options.getString
      .mockReturnValueOnce('jest') // activity
      .mockReturnValue(null) // type and url
    setBotStatus(interaction, client)
    expect(client.user.setActivity).toBeCalledWith('jest')
  })

  it('Sets "watching", "listening", "streaming", and "playing" statuses when types are given', () => {
    const interaction = discordMock.createInteraction(client)
    interaction.options.getString
      .mockReturnValueOnce('my tests') // activity
      .mockReturnValueOnce('Watching') // type
      .mockReturnValueOnce(undefined) // url
    setBotStatus(interaction, client)
    expect(client.user.setActivity).toBeCalledWith('my tests', { type: ActivityType.Watching })

    interaction.options.getString
      .mockReturnValueOnce('my songs') // activity
      .mockReturnValueOnce('Listening') // type
      .mockReturnValueOnce(undefined) // url
    const i2 = discordMock.createInteraction(client)
    setBotStatus(i2, client)
    expect(client.user.setActivity).toBeCalledWith('my songs', { type: ActivityType.Listening })

    interaction.options.getString
      .mockReturnValueOnce('my tests') // activity
      .mockReturnValueOnce('Streaming') // type
      .mockReturnValueOnce('https://youtube.com') // url
    const i3 = discordMock.createInteraction(client)
    setBotStatus(i3, client)
    expect(client.user.setActivity).toBeCalledWith('my tests', {
      type: ActivityType.Streaming, url: 'https://youtube.com'
    })

    interaction.options.getString
      .mockReturnValueOnce('a game') // activity
      .mockReturnValueOnce('Playing') // type
      .mockReturnValueOnce(undefined) // url
    const i4 = discordMock.createInteraction(client)
    setBotStatus(i4, client)
    expect(client.user.setActivity).toBeCalledWith('a game', { type: ActivityType.Playing })
  })
})
