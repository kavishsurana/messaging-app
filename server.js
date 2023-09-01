const express = require('express')
const http = require('http')
const socketIO = require('socket.io')
require('dotenv').config()
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path')
const { connect,getDB } = require('./database')

const filePath = path.join(__dirname, 'testData.csv');

// const { MongoClient } = require('mongodb');



// const uri = "mongodb+srv://<username>:<password>@messaging-app.b0pxwbh.mongodb.net/assignment?retryWrites=true&w=majority"; 
// const client = new MongoClient(uri);

// let db;

// async function connect() {
//     try {
//         await client.connect();
//         console.log('Connected to MongoDB');
//         db = client.db('messaging_app');
//     } catch (error) {
//         console.error('Error connecting to MongoDB:', error);
//     }
// }


// async function parseCSVAndInsert() {
//     await connect();
//     const filePath = path.join(__dirname, 'testData.csv');
//     const data = [];

//     fs.createReadStream(filePath)
//         .pipe(csv())
//         .on('data', (row) => {
//             data.push(row);
//         })
//         .on('end', async () => {
//             console.log(db)
//             if (!db) {
//                 console.error('Database connection is not available.');
//                 return;
//             }

//             const messagesCollection = db.collection('messages');

//             try {
//                 await messagesCollection.insertMany(data);
//                 console.log('CSV data inserted into the database');
//             } catch (error) {
//                 console.error('Error inserting CSV data into the database:', error);
//             }
//         });
// }

// parseCSVAndInsert();
// console.log('DONE!!');


const app = express()
const server = http.createServer(app)
const io = socketIO(server)

const agents = []

app.use(express.static('public'));



connect()

const customerMessages = [];

// API endpoint to receive customer messages and store in the database
app.post('/api/customer/message', express.json(), async (req, res) => {
    const { message } = req.body;
    const db = getDB();
    const messagesCollection = db.collection('messages');
    try {
        await messagesCollection.insertOne({ message });
        io.emit('new_customer_message', message);
        res.json({ success: true });
    } catch (error) {
        console.error('Error storing message in MongoDB:', error);
        res.json({ success: false, error: error.message });
    }
});

// API endpoint to retrieve all messages from the database
app.get('/api/messages', async (req, res) => {
    const db = getDB();
    const messagesCollection = db.collection('messages');
    try {
        const messages = await messagesCollection.find({}).toArray();
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages from MongoDB:', error);
        res.status(500).json({ error: error.message });
    }
});



app.post('/api/assign/query', express.json(), async (req, res) => {
    const { queryId, agentId } = req.body;
    const db = getDB();
    const queriesCollection = db.collection('queries');

    try {
        // Update the assignedAgent field in the query document
        const result = await queriesCollection.updateOne(
            { _id: queryId },
            { $set: { assignedAgent: agentId } }
        );

        if (result.modifiedCount === 1) {
            io.emit('query_assigned', { queryId, agentId }); // Notify other agents
            res.json({ success: true });
        } else {
            res.json({ success: false, message: 'Failed to assign agent.' });
        }
    } catch (error) {
        console.error('Error assigning agent:', error);
        res.json({ success: false, error: error.message });
    }
});






io.on('connection' , (socket) => {
    console.log('New Connection:', socket.id)

    socket.on('agent_join' , (agentName) => {
        agents.push({id: socket.id, name: agentName})
        io.emit('agent_list' , agents)
    })

    socket.on('customer_message', (message) => {
        io.emit('new_customer_message', message)
    })

    socket.on('agent_message', (data) => {
        const agent = agents.find((agent) => agent.id === socket.id)
        if(agent){
            io.emit('new_agent_message', {agentName: agent.name, message: data.message})
        }
    })

    socket.on('disconnect', () => {
        const index = agents.findIndex((agent) => agent.id === socket.id)
        if(index !== -1){
            agents.splice(index, 1)
            io.emit('agent_list', agents)
        }
        console.log('Disconnected:', socket.id)
    })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`)
})