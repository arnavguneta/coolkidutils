const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('@common/embed')

const fetch = require('node-fetch');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lamp')
        .setDescription('Control lamp state')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('power')
                .setDescription('Control power state for lamp')
                .addBooleanOption(option =>
                    option.setName('state')
                        .setDescription('Power state')
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('brightness')
                .setDescription('Control lamp brightness level')
                .addIntegerOption(option =>
                    option.setName('value')
                        .setDescription('Set brightness 1-3')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(3)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fan')
                .setDescription('Control lamp fan state')
                .addBooleanOption(option =>
                    option.setName('state')
                        .setDescription('Fan state')
                        .setRequired(true)
                )),
    async execute(interaction) {
        let subcommand = interaction.options.getSubcommand();
        if (subcommand === 'power') {
            const powerState = interaction.options.getBoolean('state') ? 'on' : 'off'
            let powerEmbed = embed({
                color: process.env.COLOR_PRIMARY,
                authorName: 'Lamp Power State',
                description: `Turning lamp ${powerState}...`
            }, true)
            
            fetch(`http://localhost:3001/api/v1/iot/lamp/power/${powerState}`)
            interaction.reply({ embeds: [powerEmbed] })
        }
    }
};
