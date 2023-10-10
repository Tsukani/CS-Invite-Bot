import fs from 'fs';
import { colorLog } from './logHandler';
import { startBot } from './steam/botHandler';
import './discord/discordMain';
import { updateAvailableBotCount } from './discord/discordMain';

// Starts all bots in bots.txt
Promise.all(
    fs
        .readFileSync('bots.txt', 'utf-8')
        .split('\n')
        .map(async (account) => {
            const [username, password, sharedSecret] = account.split(':');
            await startBot(...[username, password, sharedSecret]);
            return username;
        })
).then((accs) => {
    colorLog('green', `Successfully logged into ${accs.length} bot account${accs.length !== 1 ? 's' : ''}!`);
    updateAvailableBotCount();
});
