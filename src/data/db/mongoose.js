const mongoose = require('mongoose')

// Command to start db: /c/Users/arnav/mongodb/bin/mongod --dbpath=C:/Users/arnav/mongodb-data or sudo mongod --dbpath ~/data/db
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})