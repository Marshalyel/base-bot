// index.js
import { createRequire } from 'module';
import { dirname, join, resolve } from 'path'; // Menggunakan join dan resolve dari 'path'
import { fileURLToPath, pathToFileURL } from 'url';
import { readFileSync, readdirSync } from 'fs'; // Menggunakan readFileSync dan readdirSync dari 'fs'

import globalConfig from './settings/config.js';
import { connectToWhatsApp } from './auth.js'; // Mengimpor fungsi dari auth.js

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('\n=====================================');
console.log('         BOT WHATSAPP DIMULAI        ');
console.log('=====================================\n');

const PLUGINS_DIR = resolve(__dirname, "./command");

const pluginsLoader = async (directory) => {
    let plugins = [];
    const files = readdirSync(directory);
    for (const file of files) {
        const filePath = join(directory, file); // Menggunakan join
        if (filePath.endsWith(".js")) {
            try {
                const fileUrl = pathToFileURL(filePath).href;
                const pluginModule = await import(fileUrl);
                const pluginHandler = pluginModule.default;

                if (typeof pluginHandler === 'function' && pluginHandler.command) {
                    plugins.push(pluginHandler);
                } else {
                    console.log(`[PLUGIN ERROR] Plugin ${filePath} tidak memiliki struktur yang diharapkan (export default function dengan properti 'command').`);
                }
            } catch (error) {
                console.log(`[PLUGIN ERROR] Gagal memuat plugin ${filePath}:`, error);
            }
        }
    }
    return plugins;
};

async function main() {
    const { sock, loadedPlugins } = await connectToWhatsApp(pluginsLoader, PLUGINS_DIR, globalConfig);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify') {
            for (let msg of messages) {
                if (!msg.key.fromMe && msg.message) {
                    let messageBody = '';
                    if (msg.message.conversation) {
                        messageBody = msg.message.conversation;
                    } else if (msg.message.extendedTextMessage?.text) {
                        messageBody = msg.message.extendedTextMessage.text;
                    } else if (msg.message.imageMessage?.caption) {
                        messageBody = msg.message.imageMessage.caption;
                    } else if (msg.message.videoMessage?.caption) {
                        messageBody = msg.message.videoMessage.caption;
                    } else if (msg.message.listMessage?.description) {
                        messageBody = msg.message.listMessage.description;
                    } else if (msg.message.buttonsMessage?.content?.text) {
                        messageBody = msg.message.buttonsMessage.content.text;
                    } else if (msg.message.templateButtonReplyMessage?.selectedDisplayText) {
                        messageBody = msg.message.templateButtonReplyMessage.selectedDisplayText;
                    } else if (msg.message.reactionMessage?.text) {
                        messageBody = msg.message.reactionMessage.text;
                    }

                    const sender = msg.key.remoteJid;
                    const lowerCaseBody = messageBody.toLowerCase().trim();

                    const parts = lowerCaseBody.split(' ');
                    const command = parts[0];
                    const args = parts.slice(1).join(' ');

                    const plug = {
                        sock,
                        command: command,
                        text: messageBody,
                        args: args,
                        isBot: msg.key.fromMe,
                        m: msg,
                        config: globalConfig
                    };

                    let commandHandled = false;
                    let matchedCommand = '';
                    for (let pluginHandler of loadedPlugins) {
                        if (typeof pluginHandler === 'function' && pluginHandler.command) {
                            const commandsToMatch = Array.isArray(pluginHandler.command) ? pluginHandler.command : [pluginHandler.command];

                            console.log(`[DEBUG KOMPARASI] Mencoba mencocokkan perintah: "${command}" dengan plugin: "${pluginHandler.command}"`);

                            const foundCommand = commandsToMatch.find(cmd => cmd === command);
                            if (foundCommand) {
                                await pluginHandler(msg, plug);
                                commandHandled = true;
                                matchedCommand = foundCommand;
                                break;
                            }
                        }
                    }

                    if (commandHandled) {
                        console.log(`[PERINTAH DITERIMA] ${matchedCommand} dari ${sender}`);
                    } else {
                        console.log(`[INFO] Pesan tidak diproses sebagai perintah dari ${sender}: "${messageBody}"`);
                    }
                }
            }
        }
    });
}

main(); // Panggil fungsi main untuk memulai bot
