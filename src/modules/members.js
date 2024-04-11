// eslint-disable-next-line no-unused-vars
const { Guild, REST, GuildMember } = require('discord.js')
const { client } = require('./bot-setup')

/**
 * @typedef {Object} GuildMemberIDSearchResult
 * @property {GuildMember} member The guild member associated with the result
 * @property {string | null} source_invite_code The invite code the member used to join the server
 * @property {number} join_source_type The method used to join the guild
 * @property {string | null} inviter_id The ID of the user associated with the invite used
 */

/**
 * Returns a search result with invite information
 * @param {Guild} guild The guild to search
 * @param {string} id The User ID to search for
 * @returns {Promise<GuildMemberIDSearchResult>}
 */
async function searchByID (guild, id) {
  const userIDQuery = { user_id: { or_query: [id] } }
  const rest = new REST({ version: '10' }).setToken(client.token)
  const response = await rest.post(`/guilds/${guild.id}/members-search`, {
    body: { and_query: userIDQuery, limit: 1 }
  })
  console.log(response, guild.id, id)
  const result = response.members[0]
  if (result) result.member = new GuildMember(client, result.member, guild)
  return result
}

module.exports = { searchByID }
