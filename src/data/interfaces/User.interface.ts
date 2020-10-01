import { Snowflake } from "discord.js";
import Card from "./Card.interface";

export default interface User {
    id: Snowflake;
    hand: Card[];
    safe: boolean;
    DM?: {
        messageId: Snowflake;
        channelId: Snowflake;
    }
}