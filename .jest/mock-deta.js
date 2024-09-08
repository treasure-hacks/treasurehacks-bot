const { createDefaultSettings } = require('../src/listeners/config')
const deta = require('deta')

const mockBaseGet = jest.fn(id => createDefaultSettings({ id }))
const mockBasePut = jest.fn()

jest.mock('deta', () => ({
  Deta: jest.fn(() => ({
    Base: jest.fn(() => ({
      get: (...args) => mockBaseGet(...args),
      put: (...args) => mockBasePut(...args)
    }))
  }))
}))

jest.mock('../src/modules/database', () => ({
  serverSettingsDB: {
    get: (...args) => mockBaseGet(...args),
    put: (...args) => mockBasePut(...args)
  }
}))

module.exports = {
  Base: { get: mockBaseGet, put: mockBasePut },
  serverSettingsDB: { get: mockBaseGet, put: mockBasePut }
}
