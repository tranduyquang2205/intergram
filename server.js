const request = require('request');
const compression = require('compression');
const cors = require('cors');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
let online_users = {};
app.use(express.static('dist', {index: 'demo.html', maxage: '4h'}));
app.use(bodyParser.json());

// handle admin Telegram messages
app.post('/hook', function(req, res){
    try {
        console.log('kkkk',req.body.message)
        const message = req.body.message || req.body.channel_post;
        const chatId = message.chat.id;
        const name = message.from.first_name || message.from.last_name || message.chat.title || "admin";
        const text = message.text || "";
        const reply = message.reply_to_message;
        const staff_id = message.from.id

        if (text.startsWith("/start")) {
            console.log("/start chatId " + chatId);
            sendTelegramMessage(chatId,
                "*Welcome to Babygroup* \n" +
                "Your unique chat id is `" + chatId + "`\n" +
                "Use it to link between the embedded chat and this telegram chat",
                "Markdown");
        } 
        else if (text == '/reply') {
            let replyText = reply.text || "";
            let userId = replyText.split(':\n')[0].replace('ID: ','');
            if(online_users[userId]==""){
                online_users[userId] = staff_id
                sendTelegramMessage(chatId,
                    name+" đã tiếp nhận khách "+ userId,
                    "Markdown");
                sendTelegramMessage(staff_id,
                    "Bạn đã tiếp nhận khách "+ userId,
                    "Markdown");
                sendTelegramMessage(staff_id, replyText ,"Markdown");
            } 
        }
        else if (reply) {
            let replyText = reply.text || "";
            let userId = replyText.split(':\n')[0].replace('ID: ','');
            io.to(userId).emit(chatId + "-" + userId, {name, text, from: 'admin'});
        }

    } catch (e) {
        console.error("hook error", e, req.body);
    }
    res.statusCode = 200;
    res.end();
});

// handle chat visitors websocket messages
io.on('connection', function(socket){

    socket.on('register', function(registerMsg){
        let userId = registerMsg.userId;
        let chatId = registerMsg.chatId;
        let messageReceived = false;
        socket.join(userId);
        console.log("useId " + userId + " connected to chatId " + chatId);
        online_users[userId]="";
        console.log('online_users',online_users)
        socket.on('message', function(msg) {
            messageReceived = true;
            io.to(userId).emit(chatId + "-" + userId, msg);
            let visitorName = msg.visitorName ? "[" + msg.visitorName + "]: " : "";
            if(online_users[userId]==""){
                sendTelegramMessage(chatId, "*ID: " + userId + "*:\n"  + visitorName + " `" + msg.text+"`","Markdown");
            }else{
                sendTelegramMessage(online_users[userId], "*ID: " + userId + "*:\n"  + visitorName + " `" + msg.text+"`","Markdown");

            }
        });

        socket.on('disconnect', function(){
            if (messageReceived) {
                sendTelegramMessage(chatId,"Người dùng *" + userId + "* đã thoát","Markdown");
                delete online_users[userId]; 
                console.log('online_users',online_users)
            }
        });
    });

});

function sendTelegramMessage(chatId, text, parseMode) {
    request
        .post('https://api.telegram.org/bot' + process.env.TELEGRAM_TOKEN + '/sendMessage')
        .form({
            "chat_id": chatId,
            "text": text,
            "parse_mode": parseMode
        });
}

app.post('/usage-start', cors(), function(req, res) {
    console.log('usage from', req.query.host);
    res.statusCode = 200;
    res.end();
});

// left here until the cache expires
app.post('/usage-end', cors(), function(req, res) {
    res.statusCode = 200;
    res.end();
});

http.listen(process.env.PORT || 3000, function(){
    console.log('listening on port:' + (process.env.PORT || 3000));
});

app.get("/.well-known/acme-challenge/:content", (req, res) => {
    res.send(process.env.CERTBOT_RESPONSE);
});
