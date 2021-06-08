import bcrypt from "bcrypt-nodejs";
import players from '../models/players';
import roomPlayers from '../models/roomPlayers';

export const login = async (data, Socket) =>{
    const {email, password} = data;
    players.findOne({ email }, (err, result) => {
        if (err) { console.log("server  " + err) }
        if (!result) { 
            Socket.emit("err", 'Email incorrect.'); return;
        }else{
            const ismatch = bcrypt.compareSync(password, result.password);
            if(ismatch){
                Socket.emit("Login", result);
            }else{
                Socket.emit("err", 'Password incorrect.'); return;
            }
        }
    });
}

export const register = async (data, Socket) => {
    var { email } = data;
    players.findOne({ email }, (err, existingUser) => {
        if (err) { Socket.emit("err", 'Email is in use.'); return;  }
        if (existingUser) {
            Socket.emit("err", 'Email is in use.'); return;
        }
        const player = new players(data);
        player.save((err) => {
            if (err) {
                Socket.emit("err", 'user already registered'); return;
            } else {
                login(data, Socket);
            }
        });
    });
}

export const getPlayer = async (data, Socket) => {
    const {email, password} = data;
    players.findOne({ email, password }, (err, result) => {
        if (err) { console.log("server  " + err) }
        if (!result) { 
            Socket.emit("getPlayer", {status:false}); return;
        }else{
            Socket.emit("getPlayer", {status:true, result});
        }
    });
}

export const GetTotalUsers = async (data, Socket, io) =>{
    players.aggregate([
        {$group:{_id:null, tPlayer:{$sum:1}}}
    ]).then((tPlayer)=>{
        roomPlayers.aggregate([
            {$group:{_id:null, cPlayer:{$sum:1}}}
        ]).then((cPlayer)=>{
            let totalPlayer = 0;
            let currentPlayer = 0;
            if(tPlayer.length){
                totalPlayer = tPlayer[0].tPlayer;
            }
            if(cPlayer.length){
                currentPlayer = cPlayer[0].cPlayer;
            }
            io.sockets.emit("TotalUser", { totalPlayer, currentPlayer });
        })
    })
}