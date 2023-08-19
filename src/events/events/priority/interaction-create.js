const embed = require('@common/embed')
const { cooldownsConfig } = require('@common/config')
const cache = require('@data/cache')
const UserRepository = require('@repos/user');
const GuildRepository = require('@repos/guild');

async function executeCommand(command, interaction, repositories = null) {
    try {
        await command.execute(interaction, repositories);
    } catch (error) {
        console.error(`${process.env.LOG_PREFIX} ERROR: There was an error executing ${interaction.commandName} command by user ${interaction.user.username}.`, error);
    }
}

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction) {
        if (interaction.user.bot || (!interaction.isChatInputCommand() && !interaction.isAutocomplete())) return;

        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;

        // setup repositories, cache and cooldowns 
        let repositories = {}, setCache = false
        const cachedUserRepo = cache.get(`repo:user:${interaction.user.id}`)
        repositories.userRepo = (!cachedUserRepo) ? new UserRepository(interaction.user.id, interaction.user.username, interaction.guildId) : cachedUserRepo
        setCache = (!cachedUserRepo)

        if (interaction.channel.isDMBased()) {
            console.log(`${process.env.LOG_PREFIX} INFO: User ${interaction.user.username} issued command ${interaction.commandName} in DMs`)
            return await executeCommand(command, interaction, repositories)
        }

        // create a new user repo and cache it, or get a cached user repo for auto completion
        const { user, guildAccount } = await repositories.userRepo.fetchByIdOrSync()
        if (setCache) cache.set(`repo:user:${interaction.user.id}`, repositories.userRepo, cooldownsConfig.getExpiration('cache'))

        // handle autocompletes and return
        if (interaction.isAutocomplete()) {
            try {
                await command.autocomplete(interaction, repositories);
            } catch (error) {
                console.error(`${process.env.LOG_PREFIX} ERROR: There was an error auto completing ${interaction.commandName} command by user ${interaction.user.username}.`, error);
            }
            return
        }
        console.log(`${process.env.LOG_PREFIX} INFO: User ${interaction.user.username} issued command ${interaction.commandName} in guild ${interaction.guildId}`)
        
        // set up repositories for commands
        let targetUser = interaction.options.getUser('target') || undefined
        if (targetUser) {
            if (targetUser.bot) {
                if (targetUser.id != process.env.id) return interaction.reply({ embeds: [embed({ error: true, description: 'A bot is not a mentionable user' })], ephemeral: true })
                repositories.guildRepo = new GuildRepository(interaction.guildId)
                await repositories.guildRepo.fetchById()
            } else {
                repositories.targetUserRepo = new UserRepository(targetUser.id, targetUser.username, interaction.guildId)
                await repositories.targetUserRepo.fetchByIdOrSync()
            }
        }

        await executeCommand(command, interaction, repositories)
    }
};