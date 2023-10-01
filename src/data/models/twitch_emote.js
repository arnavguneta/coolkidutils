const mongoose = require('mongoose')

const emoteSchema = new mongoose.Schema({
    animated: {
        type: Boolean,
        required: true,
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
    },
    data: {
        set: {
            type: String,
            required: false,
            _id: false
        },
        active: {
            type: Boolean,
            required: false,
            _id: false
        },
        id: {
            type: Object,
            required: false,
            _id: false
        },
        type: {
            type: String,
            required: false,
            _id: false
        }
    }
})

const TwitchEmote = mongoose.model('TwitchEmote', emoteSchema)

module.exports = TwitchEmote