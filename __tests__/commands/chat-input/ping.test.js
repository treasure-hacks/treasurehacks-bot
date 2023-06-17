// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { execute } = require('../../../src/commands/chat-input/ping')

const client = discordMock.createClient({}, [])
client.ws = { ping: 100 }
const interaction = discordMock.createInteraction(client)

describe('Ping Command', () => {
  it('Replies with the bot\'s latency', async () => {
    await execute(interaction, client)
    expect(interaction.reply).toBeCalledWith({
      content: 'Pong `100ms` 🏓',
      ephemeral: true
    })
  })
})
