const mongoose = require('mongoose')

const twitchChannelSchema = new mongoose.Schema({
    guilds: {
        type: Array,
        required: true,
        _id: false
    },
    id: {
        type: String,
        required: true,
        trim: true,
        _id: false
    },
    name: {
        type: String,
        required: false,
        trim: true,
        _id: false
    }
})

const TwitchChannel = mongoose.model('TwitchChannel', twitchChannelSchema)

module.exports = TwitchChannel