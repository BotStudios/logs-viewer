const express = require('express');
const app = express();
const config = require('./config');
const path = require('path');
const mongoose = require('mongoose');
const oAuth2 = require('./oauth');
const fetch = require('node-fetch');
const helmet = require('helmet');

(async () => {
await mongoose.connect(config.databaseURI, { useUnifiedTopology: true, useNewUrlParser: true });
})();
const database = mongoose.model("modmail_logs", new mongoose.Schema({ Id: String, Channel: String, User: String, CloseAt: Date, Messages: Array }));
const settings = mongoose.model("modmail_settings", new mongoose.Schema({ tags: Object, blocked: Array, logViewers: Array }));

if(config?.oAuth2) oAuth2.setup(app, config);

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.enable('trust proxy'); 
app.use(helmet({
    contentSecurityPolicy: false
}));
app.set('views', path.join(__dirname, 'views'));
 
app.get('/', async (req, res) => { 
    console.log(await database.find({}))
    res.render('home', { auth: config?.oAuth2 && req?.isAuthenticated() == true ? true : false });
})
app.get('/:id/raw', oAuth2.verify(config, settings), async (req,res) => {
    const data = await findLog(req);
    if(!data)return res.json({ message: 'This log does not exist.' });
    res.json({
       Id: data?.Id,
       CloseAt: data?.CloseAt,
       User: data?.User,
       Channel: data?.Channel,
       Messages: data?.Messages
    });
})
app.get('/:id', oAuth2.verify(config, settings), async (req,res) => {
    const data = await findLog(req);
    if(!data)return res.json({ message: 'This log does not exist.' });
    var content = '';
    if(config?.header) content += message('Modmail', 'https://cdn.discordapp.com/embed/avatars/0.png', null, `<b>Log ID:</b> ${data?.Id} <br><b>User ID:</b> ${data?.User} <br><b>Closed At:</b> <span class="close_at">${data?.CloseAt}</span>`, 'System');
    data?.Messages?.forEach((e) => {
     for(i in e) {
      content += message(i, e[i].avatar, e[i].timestamp, format(e[i].content), [e[i]?.recipient ? { name: 'Staff', color: 'rgba(46, 204, 112, 0.75)' } : false, e[i]?.isTag ? { name: 'Tag', color: '#357bc0' } : false])
}
    })
    res.render('log', { content, auth: config?.oAuth2 == true ? true : false });
})

const format = (content) => {
    return content
    .split('<').join('&lt;')
    .split('>').join('&gt;');
}

const findLog = async (req) => {
    const db = await database.findOne({ Id: req?.params?.id });
    if(config?.oAuth2 && config?.webhookURI) {
        var user = req?.user; 
        if(user) fetch(config?.webhookURI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [{
            author: { name: `${user?.username}#${user?.discriminator}`, icon_url: `https://cdn.discordapp.com/avatars/${user?.id}/${user?.avatar}.png` },
            description: `${user?.username} viewed [**\`${db.Id}\`**](${config?.logsURI}/${db.Id}) at <t:${Math.floor(new Date().getTime() / 1000)}>`,
            timestamp: new Date()
        }] })
    }).catch(err => {});
}
    return db;
}

const message = (username, avatar, timestamp, content, tag) => {
var tags = ""; if(Array.isArray(tag)) tag.forEach((e) => { if(!e.name || !e.color)return; tags += `<span class="tag" style="background-color: ${e.color}">${e.name}</span>` });
return `<div class="message-group hide-overflow">
<div class="avatar-large" style="background-image: url(${avatar})"></div>
<div class="comment">
    <div class="message" style="height: 25px;">
       <strong class="username">${username}</strong>  
      ${tags} ${timestamp ? `<span class="timestamp">${timestamp}</span>` : ''}
    </div>
  <pre style="font-family:unset;margin:0">${content}</pre>
</div>
</div>`;
}

app.use((req, res, next) => {
    res.status(404).redirect('/');
})
app.listen(config?.port);   
