# Treasure Hacks Discord Bot

A Discord bot created for Treasure Hacks using [discord.js](https://discord.js.org/).

## Running Locally
- Install dependencies `npm install`
- Add the following variables to a `.ENV` file:
  - `API_ACCESS_TOKEN`: Access token used in calls to restricted Treasure Hacks API endpoints
  - `BOT_API_KEY`: An API Key that will allow you to access the bot's API
  - `BOT_CLIENT_ID`: The Discord Bot's Client ID
  - `CORS_ORIGINS`: Which origins to allow CORS for
  - `DISCORD_TOKEN`: The Discord Bot's API Token
  - `DETA_PROJECT_KEY`: The Deta project or collection key
  - `PORT`: The port to run the bot on locally
- Run development bot `npm run dev`
- Run jest unit tests with `npm test`
  - Tests for `treasurehacks-bot` currently mock classes in `deta` and `discord.js`.
  - These mocks are not fully comprehensive and may need to be updated depending on the tests being written.

## Development

Upon the first run of the starter, it can take up to an hour for your slash commands to be visible in the Discord Client.

Run `npm test` before pushing your changes

### Creating Commands

Command Type|Directory|Template File
-:|:-|:-
Slash (Chat Input) Command| `src/commands/chat-input/`|`templates/chat-command.js`
Context Menu Command| `src/commands/context-menu/`|`templates/ctx-command.js`
Button Action| `src/button-actions/`|`templates/button-action.js`
Modal Submission| `src/modal-actions/`|`templates/button-action.js` (for now)

For any additional help see the [discord.js guide](https://discordjs.guide).
