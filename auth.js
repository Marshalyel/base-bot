// auth.js (menyimpelkan index.js)

import pkg from '@whiskeysockets/baileys';
const { makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = pkg;
import { Boom } from '@hapi/boom';
import P from 'pino';
import qrcode from 'qrcode-terminal';

let currentSock = null; // Menyimpan instance socket WhatsApp saat ini

export const connectToWhatsApp = async (pluginsLoader, PLUGINS_DIR, globalConfig) => {
    if (currentSock) {
        try {
            if (currentSock && typeof currentSock.end === 'function') {
                await currentSock.end();
            }
        } catch (error) {
            console.log('[RESTART ERROR] Gagal menutup koneksi sebelumnya:', error);
        }
        currentSock = null;
    }

    const { state, saveCreds } = await useMultiFileAuthState('sesi');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: Browsers.macOS('Desktop'),
        msgRetryCounterMap: {},
        retryRequestDelayMs: 250,
        markOnlineOnConnect: false,
        emitOwnEvents: true,
        patchMessageBeforeSending: (msg) => {
            if (msg.contextInfo) delete msg.contextInfo.mentionedJid;
            return msg;
        }
    });

    currentSock = sock;

    const loadedPlugins = await pluginsLoader(PLUGINS_DIR);
    console.log(`[PLUGIN LOADER] Memuat ${loadedPlugins.length} plugin dari ${PLUGINS_DIR}`);

    // Event handler untuk koneksi
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n[QR] Silakan scan QR code ini dengan aplikasi WhatsApp Anda:');
            qrcode.generate(qr, { small: true });
            return;
        }

        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`[KONEKSI] Terputus. Status Kode: ${reason}`);

            if (reason === DisconnectReason.loggedOut || reason === DisconnectReason.badSession) {
                console.log('[PERINGATAN] Sesi buruk atau logout! Hapus folder "sesi" dan scan ulang untuk memulai sesi baru.');
                connectToWhatsApp(pluginsLoader, PLUGINS_DIR, globalConfig); // Rekoneksi
            } else if (reason === DisconnectReason.connectionClosed ||
                reason === DisconnectReason.connectionLost ||
                reason === DisconnectReason.restartRequired ||
                reason === DisconnectReason.timedOut) {
                console.log('[INFO] Koneksi terputus/restart diperlukan, mencoba menyambungkan ulang...');
                connectToWhatsApp(pluginsLoader, PLUGINS_DIR, globalConfig); // Rekoneksi
            } else {
                console.log(`[ERROR] Koneksi ditutup dengan alasan tidak terduga: ${reason}, ${lastDisconnect?.error}`);
                connectToWhatsApp(pluginsLoader, PLUGINS_DIR, globalConfig); // Rekoneksi
            }
        } else if (connection === 'open') {
            console.log('[KONEKSI] Berhasil terhubung ke WhatsApp!');
        } else if (connection === 'connecting') {
            console.log('[KONEKSI] Sedang mencoba terhubung...');
        }
    });

    // Event handler untuk pembaruan kredensial
    sock.ev.on('creds.update', saveCreds);

    // Mengembalikan objek sock dan loadedPlugins agar bisa digunakan di index.js
    return { sock, loadedPlugins };
};
