// Mocks must come before command imports
const discordMock = require('../../../.jest/mock-discord')
// Command Imports must come after mocks
const { greetings, sayHello } = require('../../../src/commands/chat-input/hello')

const client = discordMock.createClient({}, [])
const interaction = discordMock.createInteraction(client)
const { resolveTo } = discordMock

describe('Hello Command', () => {
  beforeAll(() => {
    this.fetch = jest.spyOn(globalThis, 'fetch')
  })
  afterEach(() => {
    this.fetch.mockReset()
    interaction.reply.mockReset()
  })

  it('Responds with just a greeting if it cannot get a random fact', async () => {
    // Make it return the first random greeting
    jest.spyOn(Math, 'floor').mockReturnValueOnce(0)
    this.fetch.mockReturnValueOnce(resolveTo())
    await sayHello(interaction)
    expect(interaction.reply).toBeCalledWith(greetings[0])
  })

  it('Changes the first sentence into a question', async () => {
    const facts = [
      'Some bees are cool. Treasure Hacks Bot knew this.',
      'Brandon is a cool co-founder.'
    ]
    // Make it return the first random greeting
    jest.spyOn(Math, 'floor').mockReturnValueOnce(0)
    this.fetch.mockReturnValueOnce(resolveTo({
      json: () => ({ text: facts[0] })
    }))
    await sayHello(interaction)
    expect(interaction.reply).toBeCalledWith(greetings[0] + ' Did you know that some bees are cool? Treasure Hacks Bot knew this.')

    jest.spyOn(Math, 'floor').mockReturnValueOnce(5)
    this.fetch.mockReturnValueOnce(resolveTo({
      json: () => ({ text: facts[1] })
    }))
    await sayHello(interaction)
    expect(interaction.reply).toBeCalledWith(greetings[5] + ' Did you know that Brandon is a cool co-founder?')
  })

  it('Corrects backticks into single quotes', async () => {
    jest.spyOn(Math, 'floor').mockReturnValueOnce(2)
    this.fetch.mockReturnValueOnce(resolveTo({
      json: () => ({ text: '`Treasure Hacks` is named after our high school.' })
    }))
    await sayHello(interaction)
    expect(interaction.reply).toBeCalledWith(greetings[2] + " Did you know that 'Treasure Hacks' is named after our high school?")
  })

  it('Turns the first word into lowercase if it matches', async () => {
    jest.spyOn(Math, 'floor').mockReturnValueOnce(0)
    this.fetch.mockReturnValueOnce(resolveTo({
      json: () => ({ text: 'There are more planes in the sea than ships in the sky.' })
    }))
    await sayHello(interaction)
    expect(interaction.reply).toBeCalledWith(greetings[0] + ' Did you know that there are more planes in the sea than ships in the sky?')
  })
})
