import { Message } from 'discord.js';
import SteamUser from 'steam-user';

export type BotRecord = {
    botClient: SteamUser;
    active: boolean;

    username: string;
    lobbyID?: string;
    rank?: number;
    gamemode: 'competitive' | 'scrimcomp2v2' | 'survival';
    message?: string;
    inviteTime: number;

    interval?: NodeJS.Timeout;
    timeout?: NodeJS.Timeout;

    accounts: {
        steamID: string;
        name: string;
        avatar: string;
    }[];

    originalEmbed?: Message<boolean>;
};
