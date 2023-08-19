const { REST } = require('@discordjs/rest');
const { Routes } = require('discord.js');

const GLOBAL_COMMANDS = [];
const GUILD_COMMANDS = {}; // { guild_id : [ commands ], ... }
const rest = new REST({ version: '10' }).setToken(process.env.token);

module.exports = (client) => {
	client.commands.each(command => {
		if (command.hasOwnProperty('isGuildCommand') && command.isGuildCommand)
			for (let guild of command.guilds) GUILD_COMMANDS[guild] = (GUILD_COMMANDS.hasOwnProperty(guild)) ? [...GUILD_COMMANDS[guild], command.data.toJSON()] : [command.data.toJSON()]
		else GLOBAL_COMMANDS.push(command.data.toJSON())
	})

	// const util = require('util')
	// console.log(util.inspect(GLOBAL_COMMANDS, false, null, true /* enable colors */))
	// console.dir(GLOBAL_COMMANDS, { depth: null });
	for (let guild in GUILD_COMMANDS) rest.put(Routes.applicationGuildCommands(process.env.id, guild), { body: GUILD_COMMANDS[guild] })
		.then(() => console.log(`${process.env.LOG_PREFIX} INFO: Successfully registered guild application commands`))
		.catch(err => console.error(`${process.env.LOG_PREFIX} ERROR: Occurred while registering guild application commands for guild ${guild}`));


	rest.put(Routes.applicationCommands(process.env.id), { body: GLOBAL_COMMANDS })
		.then(() => console.log(`${process.env.LOG_PREFIX} INFO: Successfully registered global application commands`))
		.catch(console.error);
}