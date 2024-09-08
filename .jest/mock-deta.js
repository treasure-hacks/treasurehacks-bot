const { createDefaultSettings } = require('../src/listeners/config')

const mockBaseGet = jest.fn(id => createDefaultSettings({ id }))
const mockBasePut = jest.fn()

jest.mock('../src/modules/database', () => ({
  serverSettingsDB: {
    get: (...args) => mockBaseGet(...args),
    put: (...args) => mockBasePut(...args)
  }
}))

module.exports = {
  serverSettingsDB: { get: mockBaseGet, put: mockBasePut }
}
