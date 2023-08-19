const { EmbedBuilder } = require('discord.js')

// SUCCESS green
// PRIMARY blue
// INFO yellow
// FAILURE red
const colors = {
    SUCCESS: "#48A14D",
    PRIMARY: "#0099FF",
    INFO: "#E4F567",
    FAILURE: "#E53935"
}

module.exports = (options, timestamp = true) => {
    let {
        color = process.env.COLOR_PRIMARY,
        title = undefined,
        url = undefined,
        description = undefined,
        thumbnail = undefined,
        fields = undefined,
        image = undefined,
        authorName = undefined,
        authorLink = undefined,
        footer = undefined,
        footerURL = undefined,
        error = false
    } = options

    let embed = new EmbedBuilder()
        .setColor(error ? process.env.COLOR_FAIL : color)
    if (timestamp && !error) embed.setTimestamp()
    if (title) embed.setTitle(title)
    if (url) embed.setURL(url)
    if (thumbnail) embed.setThumbnail(thumbnail)
    if (footerURL) embed.setFooter({ text: footer, iconURL: footerURL})
    else if (footer) embed.setFooter({ text: footer })
    if (authorName) embed.setAuthor({ name: authorName, iconURL: authorLink})

    try {
        if (description) embed.setDescription(description)
        if (fields) embed.addFields(...fields)
        if (image) embed.setImage(image)
    } catch (error) { }
    return embed
}