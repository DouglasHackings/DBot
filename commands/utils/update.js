import {readToken} from './tokenManager.js';
import {readFile, writeFile} from '../../fileManager.js';
import fs from 'fs';

export async function update(guild) {
    const exTokenContents = await readFile('./tokens/example.json');
    const exTokenData = JSON.parse(exTokenContents); // my variable names are so horrible

    let tokenData = await readToken(guild);
    const tokenDataKeys = Object.keys(tokenData);
    const exTokenDataKeys = Object.keys(exTokenData);

    const path = `./tokens/${guild.id}.json`;

    if (!fs.existsSync(path)) { // checks if there's an already existing token for that server
        writeFile(path, exTokenContents)

    } else if (JSON.stringify(tokenDataKeys) !== JSON.stringify(exTokenDataKeys)) {
        tokenData = {...exTokenData, ...tokenData}; // credit to Sean for this fantastically simple but amazing code
        writeFile(path, JSON.stringify(tokenData));

    }
}
