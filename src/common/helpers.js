const { Collection } = require("discord.js");

let commands = new Collection()

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// converts the command name to a mentionable command string or default prepend prefix
function getCommandStr(command) {
    let formatted_command = `${process.env.prefix}${command}`
    let slash_command = commands.find(cmd => cmd.name === command.split(' ')[0]);
    if (slash_command) formatted_command = `<${formatted_command}:${slash_command.id}>`
    return formatted_command
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initializeHelpers(clientCommands) {
    commands = clientCommands
}

module.exports = { capitalizeFirstLetter, getCommandStr, sleep, initializeHelpers }