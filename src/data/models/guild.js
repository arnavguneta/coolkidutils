const mongoose = require('mongoose')

const guildSchema = new mongoose.Schema({
    id: {
        type: Object,
        required: true,
        trim: true,
        _id : false
    }
})

const Guild = mongoose.model('Guild', guildSchema)

module.exports = Guild