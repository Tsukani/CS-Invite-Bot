import { Message } from 'discord.js';
import { updateAvailableBotCount } from '../discord/discordMain';
import { BotRecord } from 'types/BotRecord';

const botList: Record<string, BotRecord> = {};
export default botList;

// Get the availability of the bots
export const getBotStats = () => {
    return {
        total: Object.values(botList).length,
        available: Object.values(botList).filter((data) => !data.active).length
    };
};

// Connects a Discord message embed to a bot, making it possible to cancel an invite session by clicking the "Cancel" button
export const addEmbedToRecord = (embed: Message<boolean>, botName: string) => {
    botList[botName].originalEmbed = embed;
};

// Clears all tasks of a bot, and updates the available bot count
export const resetBotStatus = (bot: BotRecord) => {
    bot.active = false;
    bot.accounts = [];
    bot.message = '';
    bot.rank = -1;
    bot.gamemode = 'competitive';
    bot.inviteTime = -1;
    bot.interval = undefined;
    bot.originalEmbed = undefined;

    updateAvailableBotCount();
};
