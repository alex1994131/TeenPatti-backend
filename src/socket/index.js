import roomPlayersModel from '../models/roomPlayers';
import * as usersController from '../controllers/usersController';
import * as roomsController from '../controllers/roomsController';
import * as chatController from '../controllers/chatController';

var rooms_timer = null
export default (io) => {
  io.on("connection", async(socket) => {
    
    socket.on("Login", async (data) => {
      usersController.login(data, socket);
    });
    
    socket.on("Register", async (data) => {
      usersController.register(data, socket);
    });

    socket.on("getPlayer", async (data) => {
      usersController.getPlayer(data, socket);
    });

    socket.on("GetRooms", async (data) => {
      roomsController.get(data, socket, io);
    });
    socket.on("GetFilter", async (data) => {
      roomsController.getFilter(data, socket, io);
    });

    socket.on("createRoom", async (data) => {
      roomsController.createRoom(data, socket, io);
    });

    socket.on("JoinRoom", async (data) => {
      roomsController.JoinRoom(data, socket, io);
    });

    socket.on("EnterRoom", async (data) => {
      socket.join(data.room)
    });

    socket.on("getMyRoom", async (data) => {
      roomsController.getMyRoom(data, socket, io);
    });

    socket.on("bet", async (data) => {
      roomsController.bet(data, socket, io);
    });

    socket.on("pack", async (data) => {
      roomsController.pack(data, socket, io);
    });

    socket.on("see", async (data) => {
      roomsController.see(data, socket, io);
    });

    socket.on("show", async (data) => {
      roomsController.show(data, socket, io);
    });

    socket.on("exitRoom", async (data) => {
      socket.leave(data.room);
      roomsController.exitRoom(data, socket, io);
    });

    socket.on("Getchat", async (data) => {
      chatController.Getchat(data, socket, io)
    });
    socket.on("chat", async (data) => {
      chatController.send(data, socket, io)
    });

    socket.on("disconnect", function (data) {
      roomsController.disconnect(data, socket, io);
    });

    let i = 0;
    if (!rooms_timer){
      rooms_timer = setInterval( async ()=>{
        i++;
        await roomPlayersModel.find({socketId:'true', pack:false}).then( async delectPlayers => { 
          for (const key in delectPlayers) {
            let room = delectPlayers[key].room;
            let player = delectPlayers[key].player;
            await roomPlayersModel.deleteOne({player, room}).then(e=>{
              io.sockets.in(room).emit("room_change" , {room});
              let param = { room, player };
              roomsController.progress(param, socket, io);
            })
          }
          await roomPlayersModel.updateMany({socketId:''}, {socketId:'true'});
        })
      }, 10000);
    }
  });
}