import dotenv from 'dotenv';
import { colorLog } from './logHandler';
dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, STEAM_API, DEVELOPMENT_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !STEAM_API) {
    colorLog(
        'red',
        'Missing environment variables! Please check your .env file and make sure to rename it from .env-example to .env'
    );
    process.exit();
}

export const config = {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
    STEAM_API,
    DEVELOPMENT_GUILD_ID
};
