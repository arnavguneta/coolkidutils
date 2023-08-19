const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const embed = require('@common/embed')
// all emotes
const TwitchEmote = require('@models/twitch_emote')
// config for users
const TwitchChannel = require('@models/twitch_channel')
const fetch = require('node-fetch');
const qs = require('querystring')

// twitch_id: { current_emoji_server, current_animated_server }
let state = {};

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
                .setName('sync')
                .setDescription('Sync a registered channels emotes to its Discord servers')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('Twitch username for the channel')
                        .setRequired(true)
                        .setAutocomplete(true)
                )),
    async autocomplete(interaction) {
        const focused_value = interaction.options.getFocused()
        const subcommand = interaction.options.getSubcommand()
        let choices = await TwitchChannel.find({}), filtered_choices = []

        if (subcommand === 'sync') {
            filtered_choices = choices.filter(choice => choice.name.includes(focused_value))
        }
        await interaction.respond(
            filtered_choices.map(choice => ({ name: choice.name, value: choice.name })).slice(0, 25)
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
        if (!state.hasOwnProperty(twitch_user.id)) state[twitch_user.id] = { current_emoji_server: 0, current_animated_server: 0 }
        if (interaction.options.getSubcommand() === 'register') {
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
        }
        else if (interaction.options.getSubcommand() === 'sync') {
            if (!registration) return interaction.reply({ embeds: [embed({ description: `No registration found for ${user_option}'s channel`, error: true })], ephemeral: true })

            let links = {
                bttv: `https://api.betterttv.net/3/cached/users/twitch/${twitch_user.id}`,
                ffz: `https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${twitch_user.id}`,
                stv: `https://api.7tv.app/v2/users/${twitch_user.id}/emotes`
            }

            // list of all fetched emotes
            let emotes = []
            for (let website in links) {
                let status_fetch = await fetch(links[website])
                let status_data = await status_fetch.json()
                let fetched_emotes = (website === 'bttv') ? [...status_data.channelEmotes, ...status_data.sharedEmotes] : status_data
                for (let emote of fetched_emotes) emotes.push({ name: `${(emote.code) ? emote.code : emote.name}`, id: emote.id, website })
            }

            // get list of emote servers
            let emote_servers
            try {
                emote_servers = await get_all_emote_servers(registration.guilds, interaction.client)
            } catch (ex) {
                return interaction.reply({ embeds: [embed({ description: `Invite the bot to the emote servers and allow it to add emotes`, error: true })], ephemeral: true })
            }

            // get a list of all emote names and ids from all emote servers
            const all_emotes = await TwitchEmote.find({"channel.id": registration.id})
            all_emote_names = all_emotes.map(emote => emote.name)
            
            emote_servers = emote_servers.reverse()
            interaction.reply({ content: "Updating emotes..." })
            console.log(emotes, emote_servers, twitch_user.id)

            // if not added already, add the emote to a free server
            for (let emote_to_add of emotes) {
                if (all_emote_names.includes(emote_to_add.name)) continue
                await create_emote(emote_to_add, emote_servers, twitch_user, interaction)
            }
            return interaction.channel.send({ content: "Done updating emotes" })
        }
    },
};


// return cdn url for emote 
let get_emote_url = async (website, id, size) => {
    let link = `https://cdn.${(website === 'bttv') ? 'betterttv' : (website === 'ffz') ? 'frankerfacez' : '7tv'}.${(website === 'bttv') ? 'net' : (website === 'ffz') ? 'com' : 'app'}/emote/${id}/${size}${(website != 'ffz') ? 'x' : ''}`
    // 7tv uses webp, return as gif
    if (website === "stv") {
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
let create_emote = async (emote, emote_servers, twitch_user, interaction, emote_size = 2, current_server = -1) => {
    // current server is the minimum of either the current normal emoji server or the animated server unless a specific server was provided
    current_server = (current_server == -1) ? Math.min(state[twitch_user.id].current_emoji_server, state[twitch_user.id].current_animated_server) : current_server
    if (current_server >= emote_servers.length) {
        reset_state(twitch_user.id)
        return await interaction.channel.send(`Emote "${emote.name}" could not be added, either it is too big or no space is left on the emote servers`)
        // return console.log(`${process.env.LOG_PREFIX} ERROR: ${emote.name} could not be added, either it is too big or no space left on the emote servers`)
    }
    // rate limit timer
    await new Promise(r => setTimeout(r, Math.floor(Math.random() * 15000) + 7500));
    try {
        // add medium sized emote to the current server
        // console.log(current_server, get_emote_url(emote.website, emote.id, emote_size), emote.name)
        let created_emoji = await emote_servers[current_server].emojis.create({ attachment: await get_emote_url(emote.website, emote.id, emote_size), name: emote.name })
        let new_emote = new TwitchEmote({ name: created_emoji.name, id: created_emoji.id, animated: created_emoji.animated, channel: { id: twitch_user.id, name: twitch_user.display_name} })
        await new_emote.save()
        await interaction.channel.send(`Emote <${(new_emote.animated) ? 'a' : ''}:${new_emote.name}:${new_emote.id}> added to the emote servers`)
        reset_state(twitch_user.id)
        // console.log(`${process.env.LOG_PREFIX} INFO: Emote ${emote.name} added to server ${state[twitch_user.id].current_emoji_server+1}`)
    } catch (error) {
        if (error.message.includes('Maximum number of emojis reached')) { // maximum limit reached for normal servers, add it to the next server
            state[twitch_user.id].current_emoji_server += 1
            await interaction.channel.send(`Max number of emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server + 1}`)
            // console.log(`${process.env.LOG_PREFIX} INFO: Max number of emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}+1`)
            await create_emote(emote, emote_servers, twitch_user, interaction, emote_size, state[twitch_user.id].current_emoji_server)
        } else if (error.message.includes('Maximum number of animated emojis reached')) { // maximum limit reached for animated servers, add it to the next server
            state[twitch_user.id].current_animated_server += 1
            await interaction.channel.send(`Max number of animated emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_animated_server + 1}`)
            // console.log(`${process.env.LOG_PREFIX} INFO: Max number of animated emotes, attempting to add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}`)
            await create_emote(emote, emote_servers, twitch_user, interaction, emote_size, state[twitch_user.id].current_animated_server)
        } else if (error.message.includes('Failed to resize asset below the maximum size')) { // try to add a smaller emoji size
            try {
                if (emote_size == 1) {
                    reset_state(twitch_user.id)
                    return await interaction.channel.send(`Emote ${emote.name} could not be added to server ${current_server + 1}, size is too big`)
                    // return console.log(`${process.env.LOG_PREFIX} ERROR: Emote ${emote.name} could not be added to server ${state[twitch_user.id].current_emoji_server+1}, size is too big`)
                }
                await interaction.channel.send(`Size is too big, attempting to downscale and add emote ${emote.name} to server ${current_server + 1}`)
                // console.log(`${process.env.LOG_PREFIX} INFO: Size is too big, attempting to downscale and add emote ${emote.name} to server ${state[twitch_user.id].current_emoji_server+1}`)
                await create_emote(emote, emote_servers, twitch_user, interaction, 1, current_server)
            }
            catch (ex) {
                reset_state(twitch_user.id)
                await interaction.channel.send(`Emote ${emote.name} not added for an unhandled error`)
                // console.log(`${process.env.LOG_PREFIX} ERROR: Emote ${emote.name} not added for an unhandled error`, ex)
            }
        } else {
            await interaction.channel.send(`Failed to upload emote ${emote.name}`, error) // log error
            reset_state(twitch_user.id)
        }
    }
}