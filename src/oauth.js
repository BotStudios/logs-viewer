const session  = require('express-session')
, passport = require('passport')
, Strategy = require('passport-discord')
, cookieParser = require('cookie-parser')

module.exports.setup = (app, config) => {
passport.serializeUser(function(user, done) {
    done(null, user);
  });
passport.deserializeUser(function(obj, done) {
    done(null, obj);
  });

passport.use(new Strategy({
    clientID: `${config?.clientId}`,
    clientSecret: `${config?.clientSecret}`,
    callbackURL: `${config?.logsURI}/callback`,
    scope: ['identify'],
}, function(accessToken, refreshToken, profile, done) {
    process.nextTick(function() {
        return done(null, profile);
    });
}));

app.use(session({
    secret: `${config?.clientSecret}`,
    resave: false,
    saveUninitialized: false
}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', (req, res) => {
    if(req.isAuthenticated()) return res.redirect(`/${req.query.redirect || ''}`);
    if(req?.query?.redirect) res.cookie('redirect', `${req.query.redirect}`);
    res.redirect(`https://discord.com/oauth2/authorize?response_type=code&scope=identify&client_id=${config?.clientId}&redirect_uri=${config?.logsURI}/callback`)
});
app.get('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});
app.get('/callback', passport.authenticate('discord', { failureRedirect: '/' }), function(req, res) { 
    res.clearCookie('redirect');
    res.redirect(`/${req?.cookies?.redirect ? `${req?.cookies?.redirect}` : '' }`);
 });

}

module.exports.verify = (config, settings) => {
   return async (req, res, next) => {
       if(!config?.oAuth2)return next();
       if(req.isAuthenticated()) {
        const data = await settings.findOne({});
         if(data?.logViewers?.includes(req.user.id)) return next();
         const content = `<div class="message-group hide-overflow">
         <div class="avatar-large" style="background-image: url(https://cdn.discordapp.com/embed/avatars/0.png)"></div>
         <div class="comment">
             <div class="message" style="height: 25px;">
                <strong class="username">Modmail </strong> <span class="timestamp">${new Date()}</span>
             </div>
            <div style="background-color:#49443c;border-left:3px solid #faa81a;padding:5px;">You can't view the logs <b>${req?.user?.username}</b>, you may request access from admins.</div>
         </div>
     </div>`
         return res.render("log", { content, auth: config?.oAuth2 == true ? true : false });
       }
      return res.redirect(`/login?redirect=${req.params.id}`);
   }
}
