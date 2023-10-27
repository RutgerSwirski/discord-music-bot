import dotenv from "dotenv";

import { Client } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
} from "@discordjs/voice";
import ytdl from "ytdl-core";

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;

export const client = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildVoiceStates"],
});

const PREFIX = "!";

const connections = new Map();
const players = new Map();
const queue = new Map();

function playNextSong(guildId: string, connection: any, player: any) {
  const nextSong = queue.get(guildId)?.shift();

  if (nextSong) {
    console.log("Playing next song in queue", nextSong);
    const stream = ytdl(nextSong, { filter: "audioonly" });
    const resource = createAudioResource(stream);
    player.play(resource);
    connection.subscribe(player);
  } else {
    console.log("No songs in queue, leaving voice channel");
    player.stop();
  }
}

client.on("ready", () => {
  console.log(`${client.user?.tag} is ready!`);
});

client.login(token);

client.on("messageCreate", async (message) => {
  console.log(message, message.content);
  if (message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/g);
  const command = args.shift()?.toLowerCase();

  if (!message.content.startsWith(PREFIX)) return;

  if (command === "ping") {
    console.log("ping");
    message.reply("pong");
  }

  if (command === "join") {
    // we need to join the voice channel
    const voiceChannel = message.member?.voice.channel;

    console.log("voiceChannel", voiceChannel);

    // if there is no voice channel, join the general channel
    if (!voiceChannel) {
      message.reply("Please join a voice channel first");

      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel?.id as string,
      guildId: voiceChannel?.guild.id as string,
      adapterCreator: voiceChannel?.guild.voiceAdapterCreator as any,
    });

    connections.set(voiceChannel?.guild.id as string, connection);

    message.reply("Joined voice channel");
  }

  //skip command
  if (command === "skip") {
    let connection = connections.get(message.guild?.id as string);
    let player = players.get(message.guild?.id as string);
    playNextSong(message.guild?.id as string, connection, player);
  }

  //queue command
  if (command === "queue") {
    let queueList = queue.get(message.guild?.id as string);
    if (queueList?.length) {
      let queueString = "";
      queueList.forEach((song: string, index: number) => {
        queueString += `${index + 1}. ${song}\n`;
      });
      message.reply(`Queue:\n${queueString}`);
    } else {
      // if there is no queue, we should create one
      queue.set(message.guild?.id as string, []);

      message.reply(`There is no queue, new queue created, ${queue}`);
    }
  }

  if (command === "stop") {
    const voiceChannel = message.member?.voice.channel;
    if (voiceChannel) {
      const connection = connections.get(voiceChannel.guild.id);
      const player = players.get(voiceChannel.guild.id);

      if (player) player.stop();
      if (connection) connection.destroy();

      connections.delete(voiceChannel.guild.id);
      players.delete(voiceChannel.guild.id);

      message.reply("Stopped playing and left the voice channel.");
    } else {
      message.reply("I'm not in a voice channel!");
    }
  }

  // create a shuffle command
  if (command === "shuffle") {
    console.log(queue);
    let queueList = queue.get(message.guild?.id as string);
    if (queueList?.length) {
      // shuffle the queue
      queueList.sort(() => Math.random() - 0.5);
      queue.set(message.guild?.id as string, queueList);
      message.reply(`Queue shuffled`);
    } else {
      message.reply(`There is no queue`);
    }
  }

  if (command === "listqueue") {
    // return the queue as a list
    let queueList = queue.get(message.guild?.id as string);

    if (queueList?.length) {
      message.reply(`Queue:\n${queueList}`);

      return;
    } else {
      message.reply(`There is no queue`);

      return;
    }
  }

  if (command === "play") {
    const voiceChannel = message.member?.voice.channel;

    if (!voiceChannel) {
      message.reply("Please join a voice channel first");

      return;
    }

    const url = args[0];

    if (!url) {
      message.reply("Please provide a valid URL to play.");

      return;
    }

    if (voiceChannel) {
      let connection = connections.get(voiceChannel.guild.id);

      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        connections.set(voiceChannel.guild.id, connection);

        if (!queue.get(voiceChannel.guild.id)) {
          queue.set(voiceChannel.guild.id, []);
        }
      }

      if (!players.get(voiceChannel.guild.id)) {
        const player = createAudioPlayer();
        players.set(voiceChannel.guild.id, player);
      }

      // if something is already playing, we should add it to the queue
      if (players.get(voiceChannel.guild.id)?.state.status === "playing") {
        const queueList = queue.get(voiceChannel.guild.id) || [];
        queueList.push(url);
        queue.set(message.guild?.id as string, queueList);

        message.reply("Added song to queue");
        return;
      } else {
        const stream = ytdl(url, { filter: "audioonly" });

        const videoInfo = await ytdl.getInfo(url); // Fetch video information
        const duration = videoInfo.videoDetails.lengthSeconds;

        console.log(`Playing video with duration: ${duration} seconds`);

        const resource = createAudioResource(stream);
        const player = createAudioPlayer();

        connections.set(voiceChannel.guild.id, connection);
        players.set(voiceChannel.guild.id, player);

        player.play(resource);
        connection.subscribe(player);

        connection.on("debug", (message: string) => {
          console.log("Debug:", message);
        });

        connection.on("error", (error: Error) => {
          console.error("Error:", error.message);
          connection.destroy();
        });

        player.on("error", (error) => {
          console.error("Error:", error.message, "with track", error.resource);
          player.stop();
        });

        player.on("stateChange", (oldState, newState) => {
          if (newState.status === "idle") {
            playNextSong(voiceChannel.guild.id, connection, player);
          }
        });
      }
    } else {
      message.reply("Please join a voice channel first");
    }
  }
});
