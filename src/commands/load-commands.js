const path = require('path')
const fs = require('fs')
const { Collection } = require('discord.js');

module.exports = (client) => {
    client.commands = new Collection()
    const readCommands = (dir) => {
        const files = fs.readdirSync(path.join(__dirname, dir))
        for (const file of files) {
            const stat = fs.lstatSync(path.join(__dirname, dir, file))
            if (stat.isDirectory()) {
                readCommands(path.join(dir, file))
            } else if (file !== 'command-base.js' && file !== 'load-commands.js' && file !== 'deploy-commands.js') {
                const command = require(path.join(__dirname, dir, file))
                console.log(`${process.env.LOG_PREFIX} INFO: Enabling command "${command.data.name}"`)
                client.commands.set(command.data.name, command);
            }
        }
    }
    readCommands('.')
}