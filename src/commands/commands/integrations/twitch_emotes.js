const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('@common/embed')
// all emotes
const TwitchEmote = require('@models/twitch_emote')
// config for users
const TwitchChannel = require('@models/twitch_channel')
const fetch = require('node-fetch');
const qs = require('querystring');
const { mainConfig } = require('@common/config')

// twitch_id: { current_emoji_server, current_animated_server }
let state = {};

let emote_sets = {
    "halloween": "6338e79d63c921dabe53ad84"
};

let requiredRegistrationCommands = ['sync_emotes', 'sync_set', 'delete_set', 'toggle_emote_state']

let fetch_emotes = async (links) => {
    let emotes = []
    for (let web_type in links) {
        let url = links[web_type]
        let status_fetch = await fetch(url)
        let status_data = await status_fetch.json()
        if (web_type === 'stv') status_data = status_data["emote_set"]
        let fetched_emotes = (web_type === 'bttv') ? [...status_data.channelEmotes, ...status_data.sharedEmotes] : (web_type.includes('stv')) ? status_data.emotes : status_data
        for (let emote of fetched_emotes) emotes.push({
            name: `${(emote.code) ? emote.code : emote.name}`,
            id: emote.id,
            type: web_type,
            animated: web_type === 'stv' ? false : web_type.includes('stv') ? emote.data.animated : emote.animated,
            set: web_type === 'stv_set' ? url.substring(url.lastIndexOf('/') + 1) : 'default'
        })
    }
    return emotes
}

// return cdn url for emote 
let get_emote_url = async (type, id, size) => {
    let link = `https://cdn.${(type === 'bttv') ? 'betterttv' : (type === 'ffz') ? 'frankerfacez' : '7tv'}.${(type === 'bttv') ? 'net' : (type === 'ffz') ? 'com' : 'app'}/emote/${id}/${size}${(type != 'ffz') ? 'x' : ''}`
    // 7tv uses webp, return as gif
    if (type.includes('stv')) {
        let emote_res = await fetch(link + ".gif")
        if (emote_res.status == 200) link += ".gif"
        else link += ".png"
    }
    return link
}

// get emotes from all emote servers
let get_all_emotes = async (emote_servers) => {
    // fetch emote names and ids
    let server_emotes = await Promise.all(emote_servers.map(server => [server.emojis?.cache?.map(emoji => emoji.name), server.emojis?.cache?.map(emoji => emoji.id)]))
    // server_emotes = server_emotes[0].concat(server_emotes[1]).concat(server_emotes[2])
    let server_emotes_concat = server_emotes.map(server_emotes_by_server => server_emotes_by_server)
    // list of all added emotes [[names],[ids]]
    return [server_emotes_concat.map(server_emotes => server_emotes[0]).flat(1), server_emotes_concat.map(server_emotes => server_emotes[1]).flat(1)]
}

// get all emote servers
let get_all_emote_servers = async (guilds, client) => {
    return await Promise.all(guilds.map(server => client.guilds.fetch(server)))
}

let reset_state = (id) => {
    state[id] = { current_emoji_server: 0, current_animated_server: 0 }
}

// add given emote to a server from the server list or a specific server from the emote list
let create_emote = async (emote, emote_servers = [], twitch_user, channel, emote_size = 2, current_server = -1) => {
    if (emote_servers.length === 0 && !mainConfig.getEmotePreferences('autoUpdate')) return false
    if (emote_servers.length === 0) {
        let registration = await TwitchChannel.findOne({ id: twitch_user.id })
        if (!registration) return channel.send({ embeds: [embed({ description: `No registration found for ${user_option}'s channel`, error: true })], ephemeral: true })
        try {
            emote_servers = (await get_all_emote_servers(registration.guilds, channel.client)).reverse()
        } catch (ex) {
            return channel.send({ embeds: [embed({ description: `Invite the bot to the emote servers and allow it to add emotes`, error: true })], ephemeral: true })
        }
    }
    let emote_url = await get_emote_url(emote.type, emote.id, emote_size)
    if (!emote.animated && emote_url.includes('.gif')) emote.animated = true
    if (!state.hasOwnProperty(twitch_user.id)) reset_state(twitch_user.id)
    // current server is the minimum of either the current normal emoji server or the animated server unless a specific server was provided
    current_server = (current_server == -1) ? (emote.animated) ? state[twitch_user.id].current_animated_server : state[twitch_user.id].current_emoji_server : current_server
    if (current_server >= emote_servers.length) {
        reset_state(twitch_user.id)
        return await channel.send(`Emote "${emote.name}" could not be added, either it is too big or no space is left on the emote servers`)
        // return console.log(`${process.env.LOG_PREFIX} ERROR: ${emote.name} could not be added, either it is too big or no space left on the emote servers`)
    }
    try {
        let animated_emoji_cache = emote_servers[current_server].emojis.cache.filter(emoji => emoji.animated)
        let cur_emoji_size = emote.animated ? animated_emoji_cache.size : emote_servers[current_server].emojis.cache.size - animated_emoji_cache.size
        if (cur_emoji_size >= 50) {
            let cur_type = emote.animated ? 'current_animated_server' : 'current_emoji_server'
            state[twitch_user.id][cur_type] += 1
            let next_server = emote_servers[state[twitch_user.id][cur_type]]
            await channel.send(`Max number of emotes, attempting to add emote ${emote.name} to the "${next_server.name}" guild`)
            await create_emote(emote, emote_servers, twitch_user, channel, emote_size, state[twitch_user.id][cur_type])
        } else {
            // add medium sized emote to the current server
            // when updating for sets, if a duplicate is found in default set is found, set it to not active
            let emote_doc = await TwitchEmote.findOne({ 'channel.id': twitch_user.id, 'data.id': emote.id })
            if (emote.set !== 'default') {
                if (emote_doc) return // if new set emote already exists, skip
                await TwitchEmote.updateMany({ 'data.id': emote.id, 'data.active': true }, { $set: { 'data.active': false } })
            }
            let created_emoji
            if (!emote_doc) {
                // rate limit timer
                await rate_limit()
                created_emoji = await emote_servers[current_server].emojis.create({ attachment: emote_url, name: emote.name.replaceAll('-', '').replaceAll(':', 'colon') })
            } else {
                created_emoji = {
                    id: emote_doc.id,
                    animated: emote_doc.animated
                }
            }
            if (emote_doc && emote_doc.data.set === emote.set && emote_doc.data.active) return
            let new_emote = new TwitchEmote({ name: emote.name, id: created_emoji.id, animated: created_emoji.animated, channel: { id: twitch_user.id, name: twitch_user.display_name }, data: { active: true, set: emote.set, id: emote.id, type: emote.type } })
            await new_emote.save()
            await channel.send(`Emote "${emote.name}" <${(new_emote.animated) ? 'a' : ''}:${new_emote.name}:${new_emote.id}> added to the "${emote_servers[current_server].name}" guild with ID "${emote.id}"`)
            return true
        }

        // console.log(`${process.env.LOG_PREFIX} INFO: Emote ${emote.name} added to server ${state[twitch_user.id].current_emoji_server+1}`)
    } catch (error) {
        if (error.message.includes('Maximum number of emojis reached')) { // maximum limit reached for normal servers, add it to the next server
            state[twitch_user.id].current_emoji_server += 1
            await channel.send(`Max number of emotes, attempting to add emote ${emote.name} to the "${emote_servers[state[twitch_user.id].current_emoji_server].name}" guild`)
            // console.log(`${process.env.LOG_PREFIX} INFO: Max number of emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}+1`)
            await create_emote(emote, emote_servers, twitch_user, channel, emote_size, state[twitch_user.id].current_emoji_server)
        } else if (error.message.includes('Maximum number of animated emojis reached')) { // maximum limit reached for animated servers, add it to the next server
            state[twitch_user.id].current_animated_server += 1
            await channel.send(`Max number of animated emotes, attempting to add emote ${emote.name} to the "${emote_servers[state[twitch_user.id].current_animated_server].name}" guild`)
            // console.log(`${process.env.LOG_PREFIX} INFO: Max number of animated emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}`)
            await create_emote(emote, emote_servers, twitch_user, channel, emote_size, state[twitch_user.id].current_animated_server)
        } else if (error.message.includes('Failed to resize asset below the maximum size')) { // try to add a smaller emoji size
            try {
                if (emote_size == 1) {
                    reset_state(twitch_user.id)
                    return await channel.send(`Emote ${emote.name} could not be added to the "${emote_servers[current_server].name}" guild, size is too big`)
                    // return console.log(`${process.env.LOG_PREFIX} ERROR: Emote ${emote.name} could not be added to server ${state[twitch_user.id].current_emoji_server+1}, size is too big`)
                }
                await channel.send(`Size is too big, attempting to downscale and add emote ${emote.name} to the "${emote_servers[current_server].name}" guild`)
                // console.log(`${process.env.LOG_PREFIX} INFO: Size is too big, attempting to downscale and add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}`)
                await create_emote(emote, emote_servers, twitch_user, channel, 1, current_server)
            }
            catch (ex) {
                reset_state(twitch_user.id)
                await channel.send(`Emote ${emote.name} not added for an unhandled error`)
                // console.log(`${process.env.LOG_PREFIX} ERROR: Emote ${emote.name} not added for an unhandled error`, ex)
            }
        } else {
            console.log(error)
            await channel.send(`Failed to upload emote ${emote.name}`, error) // log error
            reset_state(twitch_user.id)
        }
    }
}

const resolve_emote = async (client, emoteInput) => {
    const emojiRegex = /<(a)?:\w+:(\d+)>/;
    const isSnowflakeID = /^\d+$/.test(emoteInput);
    const isEmoji = emojiRegex.test(emoteInput);
    let emoji;
    if (isSnowflakeID) {
        emoji = await client.emojis.resolve(emoteInput);
    } else if (isEmoji) {
        const emojiID = emoteInput.match(/\d+/)[0];
        emoji = await client.emojis.resolve(emojiID);
    }
    return emoji
}

const delete_emote = async (channel, emoteInput, auto=false) => {
    if (auto && !mainConfig.getEmotePreferences('autoUpdate')) return 
    let emoji = await resolve_emote(channel.client, emoteInput)
    if (emoji) {
        try {
            await TwitchEmote.deleteMany({ id: emoji.id });
            await emoji.delete();
            await channel.send(`Emoji "${emoji.name}" with ID "${emoji.id}" has been deleted from guild "${emoji.guild.name}".`)
        } catch (error) {
            channel.send(`Error deleting emoji "${emoji.name}" with ID "${emoji.id}".`)
            console.error(`Error deleting emoji:`, error);
        }
    } else {
        await channel.send(`No emoji found to delete.`)
    }
}

const rate_limit = async () => {
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 15000) + 10000));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch_emotes')
        .setDescription('Register or sync twitch emotes, discord integration with BTTV/FFZ/7TV')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('register')
                .setDescription('Register a new channel or update an existing registration to sync emotes')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('servers')
                        .setDescription('Comma separated list of Discord server IDs to add emotes to')
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync_emotes')
                .setDescription('Sync a registered channels emotes to its Discord servers')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sync_set')
                .setDescription('Sync a registered channels emotes to its Discord servers')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('set')
                        .setDescription('7TV set id or set alias')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete_set')
                .setDescription('Delete emotes from a registered channels emotes to its Discord servers')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('set')
                        .setDescription('7TV set id or set alias')
                        .setRequired(true)
                        .setAutocomplete(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete_emote')
                .setDescription('Delete emote from a registered channels emotes to its Discord servers')
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji or Emoji ID')
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle_emote_state')
                .setDescription('Set active state for an emote')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('emoji')
                        .setDescription('Emoji or Emoji ID')
                        .setRequired(true)
                ).addBooleanOption(option =>
                    option.setName('toggle')
                        .setDescription('Toggle active state for emoji')
                        .setRequired(true)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('auto_update')
                .setDescription('Toggle auto adding of emotes from 7TV')
                .addBooleanOption(option =>
                    option.setName('toggle')
                        .setDescription('Toggle auto update for emote additions')
                        .setRequired(true)
                )),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true)
        const subcommand = interaction.options.getSubcommand()
        let choices, filtered_choices = []
        if (requiredRegistrationCommands.includes(subcommand)) {
            if (focused.name === 'username') {
                choices = await TwitchChannel.find({})
                filtered_choices = choices.filter(choice => choice.name.startsWith(focused.value)).map(choice => ({ name: choice.name, value: choice.name }))
            } else if (focused.name === 'set') {
                choices = Object.keys(emote_sets)
                filtered_choices = choices.filter(choice => choice.includes(focused.value)).map(choice => ({ name: choice, value: choice }))
            }
        }
        await interaction.respond(
            filtered_choices.slice(0, 25)
        );
    },
    async execute(interaction) {
        if (interaction.user.id !== process.env.DEVELOPER_ID) return interaction.reply({ embeds: [embed({ description: 'Woah there...', error: true })], ephemeral: true })

        // using the provided username, get the twitch user id
        let user_option = interaction.options.getString('username')
        let twitch_user = await fetch(`https://api.twitch.tv/helix/users?login=${user_option}`, { headers: { 'Authorization': `Bearer ${process.env.TWITCH_ACCESS}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } })
        if (twitch_user.status >= 400) {
            let body = {
                'client_id': process.env.TWITCH_CLIENT_ID,
                'client_secret': process.env.TWITCH_CLIENT_SECRET,
                'grant_type': 'client_credentials',
            }
            let twitch_auth = await fetch(`https://id.twitch.tv/oauth2/token`, { method: 'POST', body: qs.stringify(body), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
            if (twitch_auth.status >= 400) return interaction.reply({ embeds: [embed({ description: `Error communication with Twitch API, status code: ${twitch_auth.status}`, error: true })], ephemeral: true })
            twitch_auth = await twitch_auth.json()
            twitch_user = await fetch(`https://api.twitch.tv/helix/users?login=${user_option}`, { headers: { 'Authorization': `Bearer ${twitch_auth.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID } })
        }
        twitch_user = await twitch_user.json()
        if (twitch_user.data.length == 0) return interaction.reply({ embeds: [embed({ description: `No Twitch account found with the username "${user_option}"`, error: true })], ephemeral: true })
        twitch_user = twitch_user.data[0]

        let registration = await TwitchChannel.findOne({ id: twitch_user.id })
        if (!state.hasOwnProperty(twitch_user.id)) reset_state(twitch_user.id)
        let subcommand = interaction.options.getSubcommand();
        if (requiredRegistrationCommands.includes(subcommand) && !registration) return interaction.reply({ embeds: [embed({ description: `No registration found for ${user_option}'s channel`, error: true })], ephemeral: true })
        if (subcommand === 'register') {
            let registration_embed = embed({
                color: process.env.COLOR_PRIMARY,
                authorName: `Twitch Emote Integration`,
                authorLink: twitch_user.profile_image_url,
                description: ``
            }, true)
            // create or update an existing registration
            if (registration) {
                // merge guilds with no duplicates
                registration.guilds = [...new Set([...registration.guilds, ...interaction.options.getString('servers').split(',')])]
            } else {
                registration = new TwitchChannel()
                registration.id = twitch_user.id
                registration.name = twitch_user.login
                registration.guilds = interaction.options.getString('servers').split(',')
            }

            // validate emote servers
            let emote_servers
            try {
                emote_servers = await get_all_emote_servers(registration.guilds, interaction.client)
            } catch (ex) {
                return interaction.reply({ embeds: [embed({ description: `Invite the bot to the emote servers and allow it to add emotes`, error: true })], ephemeral: true })
            }

            await registration.save()

            registration_embed.addFields({ name: "Profile", value: twitch_user.display_name }, { name: "Emote Servers", value: emote_servers.map(guild => guild.name).join("\n") })
            registration_embed.setDescription(`Profile Updated`)
            return interaction.reply({ embeds: [registration_embed] })
        } else if (subcommand.includes('sync')) {
            // get list of emote servers
            let emote_servers
            try {
                emote_servers = await get_all_emote_servers(registration.guilds, interaction.client)
            } catch (ex) {
                return interaction.reply({ embeds: [embed({ description: `Invite the bot to the emote servers and allow it to add emotes`, error: true })], ephemeral: true })
            }

            // get a list of all emote names and ids from all emote servers
            const all_emotes = await TwitchEmote.find({ "channel.id": registration.id, "data.active": true })
            all_emote_names = all_emotes.map(emote => emote.name)

            emote_servers = emote_servers.reverse()

            let links, set_id;
            if (subcommand === 'sync_emotes') {
                links = {
                    bttv: `https://api.betterttv.net/3/cached/users/twitch/${twitch_user.id}`,
                    ffz: `https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${twitch_user.id}`,
                    stv: `https://7tv.io/v3/users/twitch/${twitch_user.id}`
                }
            } else if (subcommand === 'sync_set') {
                let param_set_id = interaction.options.getString('set')
                set_id = emote_sets[param_set_id] || param_set_id
                links = { stv_set: `https://7tv.io/v3/emote-sets/${set_id}` }
            }

            // list of all fetched emotes
            let emotes = await fetch_emotes(links)
            interaction.reply({ content: "Updating emotes..." })

            // if not added already, add the emote to a free server
            for (let emote_to_add of emotes) {
                if (all_emote_names.includes(emote_to_add.name) && !set_id) continue
                console.log(`Processing ${JSON.stringify(emote_to_add)}`)
                await create_emote(emote_to_add, emote_servers, twitch_user, interaction.channel)
            }
            return interaction.channel.send({ content: "Done updating emotes" })
        } else if (subcommand === 'delete_set') {
            interaction.reply({ content: "Deleting emotes..." })
            let param_set_id = interaction.options.getString('set')
            set_id = emote_sets[param_set_id] || param_set_id
            // get a list of all emote names and ids from all emote servers
            const all_emotes = await TwitchEmote.find({ "channel.id": registration.id, "data.active": false, "data.set": set_id })
            for (let emote of all_emotes) {
                console.log(`Processing ${JSON.stringify(emote.name)}`)
                await rate_limit()
                await delete_emote(interaction.channel, emote.id)
            }
            await interaction.channel.send(`Done deleting emotes.`)
        } else if (subcommand === 'delete_emote') {
            const emojiInput = interaction.options.getString('emoji').trim();
            await interaction.reply(`Deleting emote...`)
            delete_emote(interaction.channel, emojiInput)
        } else if (subcommand === 'auto_update') {
            const updateToggle = interaction.options.getBoolean('toggle');
            await interaction.reply(`Auto update has been toggled from ${mainConfig.getEmotePreferences('autoUpdate')} to ${updateToggle}.`)
            mainConfig.setEmotePreferences('autoUpdate', updateToggle);
        } else if (subcommand === 'toggle_emote_state') {
            const emojiInput = interaction.options.getString('emoji').trim();
            const stateToggle = interaction.options.getBoolean('toggle');
            await interaction.reply(`Updating emote...`)
            let emoji = await resolve_emote(interaction.client, emojiInput)
            if (!emoji) return interaction.channel.send(`Failed to find emote.`)
            await TwitchEmote.findOneAndUpdate({ 'id': emoji.id, 'channel.id': registration.id }, { 'data.active': stateToggle });
            interaction.channel.send(`Updating "${emoji.name}" state to "${stateToggle}"`)
        }
    },
    create_emote,
    delete_emote
};
