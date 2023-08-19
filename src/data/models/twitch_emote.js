const mongoose = require('mongoose')

const emoteSchema = new mongoose.Schema({
    animated: {
        type: Number,
        required: false,
        _id: false
    },
    id: {
        type: Object,
        required: false,
        _id: false
    },
    name: {
        type: String,
        required: false,
        _id: false
    },
    channel: {
        id: {
            type: String,
            required: false,
            _id: false
        },
        name: {
            type: String,
            required: false,
            _id: false
        }
    }
})

const TwitchEmote = mongoose.model('TwitchEmote', emoteSchema)

module.exports = TwitchEmote