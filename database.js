const { MongoClient } = require('mongodb');
require('dotenv').config()

const uri = process.env.MONGO_URL
const client = new MongoClient(uri);

let db;

async function connect() {
    try {
        await client.connect();
        db = client.db('messaging-app');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }
}


function getDB() {
    return db;
}

module.exports = { connect, getDB };

