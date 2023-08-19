const { Client, Partials, GatewayIntentBits } = require('discord.js')

require('module-alias/register')
require('@data/db/mongoose')
require('events').EventEmitter.defaultMaxListeners = 40;

const loadEvents = require('@root/events/load-events')

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers, GatewayIntentBits.GuildWebhooks, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessages, GatewayIntentBits.DirectMessageReactions],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
})
// GatewayIntentBits.GuildMembers
loadEvents(client)

client.login(process.env.token)