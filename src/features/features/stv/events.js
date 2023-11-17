const EventSource = require('eventsource')
const fetch = require('node-fetch')
const { EmbedBuilder } = require('discord.js');
const { mainConfig } = require('@common/config')
const { create_emote, delete_emote } = require('@commands/integrations/twitch_emotes')
const { sleep } = require('@common/helpers')
const TwitchEmote = require('@models/twitch_emote')

const EMOTE_SET_UPDATE = 'emote_set.update'
const CONFIGS = [{ name: 'erobb221', set: '61f463a74f8c353cf9fbac98', update_channel: '1171319663251181578' }, { name: 'coolkidarnie', set: '64e147f2e4d325845e86a5e7', update_channel: '990042551979499590' }]
const DEBUG_CHANNEL = '990042551979499590'

let pendingEmotes = {}

module.exports = async (client) => {
    let sets = CONFIGS.map(config => `emote_set.update<object_id=${config.set}>`).join(",")
    let source = new EventSource(`https://events.7tv.io/v3@${sets}`);
    source.addEventListener('hello', e => console.log(e.data), false);
    source.addEventListener('subscribe', e => console.log(e.data), false);
    source.addEventListener('dispatch', e => handleDispatch(e.data, client), false);
}

const handleDispatch = async (event, client, config) => {
    event = JSON.parse(event)
    if (event.type !== EMOTE_SET_UPDATE) return
    const setRes = await fetch(`https://7tv.io/v3/emote-sets/${event.body.id}`)
    const setJson = await setRes.json()
    const username = setJson.owner.username
    const currentConfig = CONFIGS.find(config => config.name === username)
    const embed = new EmbedBuilder()
        .setAuthor({ name: `${username}'s emotes`, iconURL: `https:${setJson.owner.avatar_url}`, url: `https://twitch.tv/${username}` })
        .setFooter({ text: '7TV Emote Updates', iconURL: 'https://i.imgur.com/l5O6kYn.png' })
        .setTimestamp();
    let body = {};
    if (event.body.hasOwnProperty('pushed')) {
        embed.setColor(mainConfig.getThemeColor('success'))
        body = event.body.pushed[0].value.data
        embed.setTitle(`Emote ${body.name} added`)
        embed.setImage(`https:${body.host.url}/3x.${body.animated ? 'gif' : 'png'}`)
    } else if (event.body.hasOwnProperty('pulled')) {
        console.log(JSON.stringify(event))
        embed.setColor(mainConfig.getThemeColor('fail'))
        body = event.body.pulled[0].old_value
        embed.setTitle(`Emote ${body.name} removed`)
        let link = `https://cdn.7tv.app/emote/${body.id}/3x`
        let emoteRes = await fetch(`${link}.gif`)
        if (emoteRes.status == 200) link += ".gif"
        else link += ".png"
        embed.setImage(link)
    }


    const debugChannel = client.channels.cache.get(DEBUG_CHANNEL);
    const updateChannel = client.channels.cache.get(currentConfig.update_channel);
    if (updateChannel) {
        let notifyChannel = updateChannel
        if (event.body.hasOwnProperty('pushed')) {
            let emote = {
                name: body.name,
                id: body.id,
                animated: body.animated,
                type: event.body.id === currentConfig.set ? 'stv' : 'stv_set',
                set: event.body.id === currentConfig.set ? 'default' : event.body.id,
            }
            const ownerRes = await fetch(`https://7tv.io/v3/users/${setJson.owner.id}`)
            const ownerJson = await ownerRes.json()
            console.log(`Processing emote ${JSON.stringify(emote)}`)
            pendingEmotes[emote.id] = true
            let status = await create_emote(emote, undefined, ownerJson.connections[0], debugChannel)
            pendingEmotes[emote.id] = false
            if (!status) notifyChannel = debugChannel
        } else {
            await sleep(5000)
            while (pendingEmotes[body.id]) {
                debugChannel.send(`Sleeping for pending emote "${body.name}"`)
                await sleep(30000)
            }
            let addedEmote = await TwitchEmote.findOne({ 'data.id': body.id });
            if (addedEmote) delete_emote(debugChannel, addedEmote.id, true)
        }
        updateChannel.send({ embeds: [embed] })
    }
}