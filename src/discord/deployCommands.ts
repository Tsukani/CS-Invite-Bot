import { REST, Routes } from 'discord.js';
import { config } from '../environmentConfig';
import { commands } from './commands';
import { colorLog } from '../logHandler';

const commandsData = Object.values(commands).map((command) => command.commandMeta);

const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

export const deployCommands = async ({ guildId }: { guildId: string }) => {
    try {
        colorLog('blue', 'Deploying slash commands...', 'Discord');
        await rest
            .put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId), {
                body: commandsData
            })
            .then(() => colorLog('green', `Successfully deployed slash commands to ${guildId}!`, 'Discord'))
            .catch(console.error);
    } catch (error) {
        console.error(error);
    }
};
