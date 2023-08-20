const ROLES_CHANNEL = '990042551979499590', LIVE_ROLE = '1142908243509788733'

module.exports = {
    name: 'messageReactionAdd',
    once: false,
    async execute(reaction, reactor) {
        if (reaction.partial) {
            try { await reaction.fetch() }
            catch { return }
        }
        if (reactor.bot || (reaction.message.author.id !== process.env.id && reaction.message.author.id !== process.env.DEVELOPER_ID) || reaction._emoji.name !== '✅') return

        // verification for support server
        if (reaction.message.channel.id === ROLES_CHANNEL) {
            let role = reaction.message.guild.roles.cache.find(role => role.id === LIVE_ROLE);
            reaction.message.guild.members.fetch(reactor.id).then(member => member.roles.add(role))
        }
    },
};