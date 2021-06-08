import Chat from "../models/chat";

export const send = async (data, Socket, io) =>{
    await Chat.create(data);
    Socket.broadcast.in(data.room).emit("chat", data);
}

export const Getchat = async (data, Socket, io) =>{
    const { room } = data;
    let roomChat = await Chat.find({room});
    Socket.emit("Getchat" , roomChat);
}