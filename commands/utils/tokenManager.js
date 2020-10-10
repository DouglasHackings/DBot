import {readFile} from '../../fileManager.js';
import fs from 'fs';

export async function readToken(guild) {
    let tokenData = {}; // probably better way to do this
    const path = `./tokens/${guild.id}.json`;
    if (fs.existsSync(path)) { // checks if the token exists
        tokenData = await readFile(path);
        tokenData = JSON.parse(tokenData);
    }
    return tokenData;
}
