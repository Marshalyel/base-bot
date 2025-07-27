// handler.js

export const extractMessageContent = (message) => {
    if (!message) {
        return '';
    }

    if (message.conversation) {
        return message.conversation;
    } else if (message.extendedTextMessage?.text) {
        return message.extendedTextMessage.text;
    } else if (message.imageMessage?.caption) {
        return message.imageMessage.caption;
    } else if (message.videoMessage?.caption) {
        return message.videoMessage.caption;
    } else if (message.listMessage?.description) {
        return message.listMessage.description;
    } else if (message.buttonsMessage?.content?.text) {
        return message.buttonsMessage.content.text;
    } else if (message.templateButtonReplyMessage?.selectedDisplayText) {
        return message.templateButtonReplyMessage.selectedDisplayText;
    } else if (message.reactionMessage?.text) {
        return message.reactionMessage.text;
    } else if (message.locationMessage?.name) {
        return message.locationMessage.name;
    } else if (message.contactsArrayMessage?.displayName) {
        return message.contactsArrayMessage.displayName;
    } else if (message.documentMessage?.caption) {
        return message.documentMessage.caption;
    }

    return '';
};
