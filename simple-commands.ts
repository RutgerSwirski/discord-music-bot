import { client } from ".";

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} from "@discordjs/voice";

import ytdl from "ytdl-core";

client.on("messageCreate", async (message) => {
    if(message.author.bot) return;

