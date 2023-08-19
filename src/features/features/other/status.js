const { ActivityType } = require('discord.js');

module.exports = async (client) => {
    client.user.setPresence({ activities: [{ type: ActivityType.Playing, name: `Online` }], status: 'online' })
}


