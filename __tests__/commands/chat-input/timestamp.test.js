// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { generateTimestamp } = require('../../../src/commands/chat-input/timestamp')

const client = discordMock.createClient({}, [])
client.ws = { ping: 100 }
const interaction = discordMock.createInteraction(client)

describe('Timestamp Command', () => {
  it('Replies with an error if the timestamp is invalid', () => {
    interaction.options.getString.mockReturnValueOnce('invalid')
    generateTimestamp(interaction, client)
    expect(interaction.reply).toBeCalledWith({
      content: 'Error: Invalid timestamp',
      ephemeral: true
    })
  })

  it('Replies with the correct timestamps when given a valid Date value', () => {
    interaction.options.getString.mockReturnValueOnce('6/17/23 4:00 PM PDT')
    generateTimestamp(interaction, client)
    expect(interaction.reply).toBeCalledWith({
      content: '<t:1687042800:F>\n`<t:1687042800:F>`\n\n<t:1687042800:R>\n`<t:1687042800:R>`',
      ephemeral: true
    })
  })
})
