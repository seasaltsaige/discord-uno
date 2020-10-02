# What is discord-uno?
Discord-UNO is meant to be an easy to use, fast, and efficient way to create and handle your very own UNO! games in your Discord bot! You can see an example of this package in use [here](https://github.com/Maxisthemoose/example-discord-uno-bot).
## Table of Contents
1. [What is discord-uno](https://github.com/Maxisthemoose/discord-uno#what-is-discord-uno)
2. [Table of Contents](https://github.com/Maxisthemoose/discord-uno#table-of-contents)
3. [Installation](https://github.com/Maxisthemoose/discord-uno#installation)
4. [Getting Started](https://github.com/Maxisthemoose/discord-uno#getting-started)
5. [Documentation](https://github.com/Maxisthemoose/discord-uno#documentation)
## Installation
```
npm install discord-uno
```
## Getting Started
##### Please note, this is an early version of discord-uno, expect bugs. Some methods have not been completed. You can report bugs to me at either `That Duck Max#8153` on Discord or email me at `oriontothemax@gmail.com`
Make sure you have installed the latest stable version of [Node.js](https://nodejs.org/en/)
### Using commonjs
```js
const Discord = require("discord.js");
const { DiscordUNO } = require("discord-uno");
const client = new Discord.Client();
const discordUNO = new DiscordUNO(); /** You can add an optional string to the class, 
                                    this string (color) will be the color for all embeds that 
                                    are sent. ie: new DiscordUNO("RED"), any Discord ColorResolvable
                                    will work. **/

client.on("ready", () => {
    console.log("Ready!");
});

client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        await discordUNO.createGame(message);
    }
});

client.login("token");
```
### Using modules
```js
import { Client } from "discord.js";
import { DiscordUNO } from "discord-uno";
const client = new Client();
const discordUNO = new DiscordUNO(); /** You can add an optional string to the class, 
                                    this string (color) will be the color for all embeds that 
                                    are sent. ie: new DiscordUNO("RED"), any Discord ColorResolvable
                                    will work. **/

client.on("ready", () => {
    console.log("Ready!");
});

client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame") {
        await discordUNO.createGame(message);
    }
});

client.login("token");
```

# Documentation
### createGame(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!creategame")
        await discordUNO.createGame(message);
});
```
To create a new UNO game, call the createGame() method. This method accepts one parameter, which is the Message object. This allows discord-uno to send and handle messages on its own. This method will return a message letting users know that they can now join the game. (Games are based off of channel ID).
___
### addUser(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!join")
        await discordUNO.addUser(message);
});
```
To add a user to the current game, call the addUser() method. This method accepts one parameter, which is the Message object. This method handles adding users to the game in the current channel. This will automatically start the game if the user count reaches ten.
___
### removeUser(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!leave")
        await discordUNO.removeUser(message);
});
```
To remove a user from the game, call the removeUser() method. This method accepts one parameter, whcih is the Message object. This method will handle removing users from the game and returning their cards to the "deck".
___
### startGame(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!startgame")
        await discordUNO.startGame(message);
});
```
To manually start the game, call the startGame() method. This method accepts one parameter, which is the message object. This method will only work if the game has at least two users entered. Otherwise it will return. On success this method will send each user their cards and a starting message to the game channel.
___
### endGame(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!endgame")
        await discordUNO.endGame(message);
});
```
To end the game in its current state, call the endGame() method. This method accepts one parameter, which is the message object. This method will end the game in whatever the current state is. It will determine the winners based off of how many cards users have left in there hand, then it will return a message with the winners.
___
### closeGame(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!closegame")
        await discordUNO.closeGame(message);
});
```
To close the current game without scoring results, call the closeGame() method. This method accepts one parameter, which is the message object. This method will close the game without scoring any of the users and will immediately end the game. No score will be output and a new game can be created.
___
### playCard(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase().startsWith("!play"))
        await discordUNO.playCard(message);
});
```
To play a card in your hand, call the playCard() method. This method accepts one parameter, which is the message object. This method will handle playing the card called. On success, it will remove the card from their hand and replace the top card. On fail it will return.
___
### UNO(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase().startsWith("!UNO"))
        await discordUNO.UNO(message);
});
```
To both protect yourself from UNO! Callouts or call someone else out for having one card left, call the UNO() method. This method accepts one parameter, which is the message object. This method will handle both protecting yourself from future UNO! callouts, and calling other users out that haven't been protected.
___
### draw(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!draw")
        await discordUNO.draw(message);
});
```
To add a card to your hand, call the draw() method. This method accepts one parameter, which is the message object. This method will handle adding cards to the users hand. Players can't draw if it isn't their turn and if they have a card they can play, they can't draw.
___
### viewCards(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!cards")
        await discordUNO.viewCards(message);
});
```
To view your current hand in the game, call the viewCards() method. This method accepts one parameter, which is the Message object. This method will handle showing users the current cards that they have in their hand. It will return a dirrect message to the user with their hand.
___
### viewTable(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!table")
        await discordUNO.viewTable(message);
});
```
To view the current state of the game, call the viewTable() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image to the channel with all the current information of the game. Including rotation, whos turn it is, how many cards each user has, whos in the game, and the top card of the pile.
___
### viewWinners(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!viewwinners")
        await discordUNO.viewWinners(message);
});
```
To view the current winners of the game (if there are any), call the viewWinners() method. This method has one parameter, which is the Message object. This method will handle creating and sending an image identical to the one sent in the endGame() method. The only difference is this method can be called at any time to view the current standings of the game.
___
### updateSettings(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!settings")
        await discordUNO.updateSetting(message);
});
```
To update the servers UNO! settings, call the updateSettings() method. This method has one parameter, which is the Message object. This method handles updating the servers UNO! settings. (The settings are stored by Channel ID). It will send a message and react to the message, allowing you to change settings based on reactions.
___
### viewSettings(message: Message): Promise\<Message\>
```js
client.on("message", async message => {
    if (message.content.toLowerCase() === "!viewsettings") 
        await discordUNO.viewSettings(message);
});
```
To view the current servers UNO! settings, call the viewSettings() method. This method has one parameter, which is the Message object. This method will return a message showing which customizable settings have been turned on or off.