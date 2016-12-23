const app = require('express')();
const bodyParser = require('body-parser');
const http = require('http').Server(app);
const io = require('socket.io')(http);
const request = require('request');
const useEnvFile = require("node-env-file");

if (process.env.USE_ENV_FILE) {
    useEnvFile(".env");
}

const topicOwner = {};
const ownerTopic = {};
const ownerName = {};

app.use(bodyParser.json()); // for parsing application/json

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

function sendMessage(chatId, text) {
    console.log(chatId + " : " + text);
    request
        .post('https://api.telegram.org/bot' + process.env.TELEGRAM_TOKEN + '/sendMessage')
        .form({
            "chat_id": chatId,
            "text": text,
            "parse_mode": "Markdown"
        });
}

app.post('/hook', function(req, res){
    let chatId = req.body.message.chat.id;
    let text = req.body.message.text;

    if(!text) {
        sendMessage(chatId, "Something went wrong, message is empty");
    }

    text = text.trim();

    if (text.startsWith("/start")) {
        sendMessage(chatId, "*Welcome to intergram* \n" +
            "Please type `'/register #uniqe_topic_name'` to register your chat identifier.\n" +
            "To change your display name in the chat type `'/setname Lewis Carroll'` i.e.");
    } else if (text.startsWith("/setname")) {
        let name = text.split("/setname")[1].trim();
        ownerName[chatId] = name;
        sendMessage(chatId, "Name set to " + name);
    } else if (text.startsWith("/register")) {
        let topic = text.split(' ')[1];

        if (!topic) {
            sendMessage(chatId, "Could not register");
        } else if (!topicOwner[topic]) {
            topicOwner[topic] = chatId;
            ownerTopic[chatId] = topic;
            sendMessage(chatId, "You have registered " + topic);
        } else {
            sendMessage(chatId, "The topic " + topic + " is already taken");
        }
    } else if (ownerTopic[chatId]) {
        let name = ownerName[chatId] || "admin";
        io.emit(ownerTopic[chatId], name + ": " + text);
    } else {
        sendMessage(chatId, "Something went wrong, please register ");
    }

    res.statusCode = 200;
    res.end();
});

io.on('connection', function(client){

    client.on('register', function(topic){
        console.log("web client " + client.id + " registered to " + topic);
        if (topicOwner[topic]) {
            sendMessage(topicOwner[topic], "new visitor " + client.id);
        }

        client.on(topic, function(msg) {
            if (topicOwner[topic]) {
                sendMessage(topicOwner[topic], "message from " + client.id + " : " + msg);
                io.emit(topic, msg);
            } else {
                io.emit(topic, "The topic " + topic + " was not registered yet, " +
                    "please register it with the intergram bot first");
            }

        });

        client.on('disconnect', function(){
            if (topicOwner[topic]) {
                sendMessage(topicOwner[topic], "message from " + client.id + " : " + msg);
            } else {
                console.log("client " + client.id + " left");
            }
        });
    });

    client.on('disconnect', function(){
        console.log("client " + client.id + " left");
    });
});

http.listen(process.env.PORT || 3000, function(){
    console.log('listening on *:' + process.env.PORT || 3000);
});