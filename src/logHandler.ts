import chalk from 'chalk';

export const colorLog = (
    color: 'red' | 'green' | 'yellow' | 'blue' | 'magenta',
    message: string,
    username?: string
) => {
    const capitalize = (string: string) => string.charAt(0).toUpperCase() + string.slice(1);

    const colorName = `bg${capitalize(color)}` as 'bgRed' | 'bgGreen' | 'bgYellow' | 'bgBlue' | 'bgMagenta';

    console.log(
        username ? chalk[colorName].bold(` ${username} `) + chalk[color](` ${message}`) : chalk[color](message)
    );
};
