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
                .addStringOption(option =>
                    option.setName('level')
                        .setDescription('Set brightness level')
                        .setRequired(true)
                        .addChoices({ name: 'High', value: 'high' }, { name: 'Medium', value: 'medium' }, { name: 'Low', value: 'low' })
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
        let lampEmbed = embed({
            color: process.env.COLOR_PRIMARY,
            authorName: 'Lamp',
            description: ''
        }, true)

        if (subcommand === 'power') {
            const powerState = interaction.options.getBoolean('state') ? 'on' : 'off'
            fetch(`http://localhost:3001/api/v1/iot/lamp/power/${powerState}`)
            lampEmbed.setDescription(`Turning lamp ${powerState}...`)
        } else if (subcommand == 'brightness') {
            const brightnessLevel = interaction.options.getString('level')
            lampEmbed.setDescription(`Turning lamp brightness to ${brightnessLevel}...`)
            fetch(`http://localhost:3001/api/v1/iot/lamp/brightness/${brightnessLevel}`)
        }
        interaction.reply({ embeds: [lampEmbed] })
    }
};
