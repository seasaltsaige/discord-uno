# What is discord-uno?
Discord-UNO is meant to be an easy to use, fast, and efficient way to create and handle your very own UNO! games in your Discord bot!
## Installation
```
npm install discord-uno
```
## Getting Started
```js
const Discord = require("discord.js");
const DiscordUNO = require("discord-uno");
const client = new Discord.Client();

const discordUNO = new DiscordUNO(client);

client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        await discordUNO.createGame(message);
    }
});

client.login("token");
```

# Documentation
