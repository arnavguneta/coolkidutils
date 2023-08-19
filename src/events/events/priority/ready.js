const loadFeatures = require('@root/features/load-features')
const loadCommands = require('@root/commands/load-commands')
const deployCommands = require('@root/commands/deploy-commands')
const { mainConfig } = require('@common/config')
const { initializeHelpers } = require('@common/helpers')


module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        try {
            client.appCommands = await client.application.commands.fetch()
            initializeHelpers(client.appCommands)
            loadCommands(client)
            if (mainConfig.getDeployCommands()) {
                console.log(`${process.env.LOG_PREFIX} INFO: Registering application commands`)
                deployCommands(client)
                mainConfig.setDeployCommands(false)
            }
            await loadFeatures(client)
        } catch (error) {
            console.error(`${process.env.LOG_PREFIX} Error on startup`, error);
        }
    },
};
