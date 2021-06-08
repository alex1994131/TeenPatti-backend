import _ from "lodash";
import * as cards from './cards';
import { DIR } from '../../config';
import logToFile from 'log-to-file';
import rooms from '../models/rooms';
import roomPlayers from '../models/roomPlayers';
import Chat from '../models/chat';
const ObjectId = require('mongoose').Types.ObjectId;
var rooms_timer = {};

export const Create = async (data, Socket, io) =>{
  data = Object.assign({},data, {room:Socket});
  const room = new rooms(data);
  room.save((err, data) => {
    if (err) {
      console.log('err', err)
    } else {
      console.log('data', data)
    }
  });
}

export const createRoom = async (data, Socket, io) =>{
  for (var x = 0, ln = roomsData.length; x < ln; x++) {
    setTimeout(function(y) {    
      Create(roomsData[y], y);
    }, x * 500, x);
  }
}

export const progress = async (data, Socket, io) => {
  const { room } = data;
  rooms.findOne({_id : room}).then(async(roomData) => {
    const nextPlayers = await getNextPlayers(room);
    if(roomData.roomType==='Limited'&&roomData.allPot>=roomData.maxPot){
      let playerData =  await roomPlayers.find({ room, seated:true, pack:false });
      for(const key in playerData){
        let rankData = await scoreHandsNormal(playerData[key].cards);
        await rankUpdate(playerData[key].player, rankData);
      }
      await gameEnd({room}, Socket, io);
    }else if(nextPlayers.length>0){
      if(nextPlayers.length >= roomData.minPlayer){
        let isAll = await isAllTalked(room);
        let isSeted = await setNCurrentPlayer(room);
        if(isSeted){ io.sockets.in(room).emit("room_change" , {room}) }
        if(isAll){
          await blindCountUpdate(room);
          if((roomData.blindCount+1)==roomData.maxBlind){ await seeUpdate(room); }
        }
      }else{
        await gameEnd({room, player:nextPlayers[0].player}, Socket, io);
        await roomPlayers.deleteMany({room,isClose:true});
        io.sockets.in(room).emit("room_change" , {room});
      }
    }
  })
}

export const get = async (data, Socket, io) =>{
  let roomsData = await rooms.find({}).sort({ roomType:0, maxPot:0 });
  var resultRoom = [];
  for (const i in roomsData) {
    var players = await roomPlayers.find({ room : roomsData[i]._id});
    resultRoom.push(Object.assign({}, roomsData[i]._doc, {players}));
  }
  io.sockets.emit("GetRooms", resultRoom);
}

export const getFilter = async (data, Socket, io) =>{
  let roomType = await rooms.aggregate().group({ _id: '$roomType' }).exec();
  let maxPlayer = await rooms.aggregate().group({ _id: '$maxPlayer' }).exec();
  let maxBlind = await rooms.aggregate().group({ _id: '$maxBlind' }).exec();
  Socket.emit('GetFilter', {roomType, maxPlayer, maxBlind});
}

export const getMyRoom = async (data, Socket, io) => {
  const { room } = data;
  let playersResult =  await roomPlayers.find({room}).populate('player').populate('roomPlayer').exec();
  let roomResult = await rooms.findById(room);
  if(data.player){
    let player = data.player;
    let newTime = (new Date()).valueOf();
    let myResult = await roomPlayers.findOneAndUpdate({room, player}, {socketId:Socket.id});
    return Socket.emit('getMyRoom',{room:roomResult, players:playersResult, my:myResult, newTime});
  }else{
    return Socket.emit('getMyRoom',{room:roomResult, players:playersResult, my:{}});
  }
}

export const JoinRoom = async (data, Socket, io) =>{
  const { chips, _id } = data.userinfo;
  let log = `JoinRoom==============room: ${data.roominfo._id}==player: ${_id}==amount: ${chips}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  roomPlayers.findOne({player:_id}).then(alreadyAtrooms => {
    if(alreadyAtrooms) {
      Socket.emit("err", 'Now you are playing room.'); return;
    }else{
      rooms.findById(data.roominfo._id).exec().then(room => {
        if(room){
          roomPlayers.find({room:data.roominfo._id}).then(async roomUsers => {
            if(roomUsers.length == room.maxPlayer){
              Socket.emit("err", 'This room is full seated.'); return;
            }else{
              await roomPlayers.create({room:data.roominfo._id, player:_id, chips, position:data.position}).then(async e =>{
                io.sockets.emit("user_change");
                if((roomUsers.length + 1) >= room.minPlayer&&!room.finished&&!room.status){
                  await rooms.updateOne({_id:data.roominfo._id}, {status:true}).then( async ()=>{
                    var dealer = roomUsers.length > 0 ? roomUsers[0].player:_id;
                    await roomPlayers.updateMany({room:data.roominfo._id}, {seated:true, $inc:{chips:(-room.bootAmount)}}).then(() => {});
                    await roomPlayers.updateOne({player:dealer}, {dealer:true}).then(async()=>{ 
                      await newRound(data.roominfo._id);
                    })
                  })
                }
                io.sockets.in(data.roominfo._id).emit("room_change", {room:data.roominfo._id});
              })
            }
          })
        }else{ Socket.emit("err", 'This room is not exist.'); return;}
      })
    }
  })
}

export const bet = async (data, Socket, io) => {
  let { room, player, amount } = data;
  amount = parseFloat(data.amount);
  let log = `bet==============room: ${room}==player: ${player}==amount: ${amount}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await rooms.findById(room).then( async (roomData) => {
    let channel = parseFloat(roomData.channel);
    await roomPlayers.updateOne({ room, player, seated:true }, {talked:true, lastTime:new Date()});
    let players = await roomPlayers.findOne({ room, player, seated:true });
      if(players.see){
        await potUpdate(room, player, amount);
        if(amount!=channel*2){
          await channelUpdate(room, channel);
        }
        await progress(data, Socket, io);
      }else{
        await potUpdate(room, player, amount);
        if(amount!=channel){
          await channelUpdate(room, channel);
        }
        await progress(data, Socket, io);
      }
    })
}

export const pack = async (data, Socket, io) => {
  const { room, player} = data;
  let log = `pack==============room: ${room}==player: ${player}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await roomPlayers.updateOne({room, player}, {cards:[], pack:true, talked : true}).then( async()=>{
    await progress(data, Socket, io)
  })
}

export const see = async (data, Socket, io) => {
  const {room, player} = data;
  let log = `see==============room: ${room}==player: ${player}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await roomPlayers.updateOne({room, player}, {see:true}).then( async()=>{
    await roomPlayers.find({room, see:false, pack:false}).then(async e=>{
      if(!e.length){
        await rooms.updateOne({_id:room}, {see:true}).then(async e1=>{
          io.sockets.in(room).emit("room_change" , {room});
        })
      }else{
        io.sockets.in(room).emit("room_change" , {room});
      }
    })
  })
}

export const show = async (data, Socket, io) => {
  const {room, player} = data;
  let log = `show==============room: ${room}==player: ${player}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await roomPlayers.find({room, seated:true}).sort({ position:-1 }).then(async players => {
    const PIndex = players.findIndex(e => e.player == player);
    const players1 = [...players, ...players];
    for(let i = PIndex; i<=players1.length; i++){
      let SPlayer = players1[i + 1];
      if(!SPlayer.pack){
        let pCard = players1[PIndex].cards;
        let sCard = SPlayer.cards;
        let SrankData = await scoreHandsNormal(sCard);
        await rankUpdate(SPlayer.player, SrankData);
        let PrankData = await scoreHandsNormal(pCard);
        await rankUpdate(player, PrankData);
        if(SrankData.score>PrankData.score){
          await roomPlayers.updateOne({room, player},{pack:true}).then(async e=>{
            roomPlayers.updateOne({room, player},{cards:[]}).then(e=>{
              io.sockets.in(room).emit("room_change" , {room});
            })
            return await progress(data, Socket, io);
          })
        }else{
          await roomPlayers.updateOne({room, player:SPlayer.player},{pack:true}).then(async e=>{
            roomPlayers.updateOne({room, player:SPlayer.player},{cards:[]}).then(e=>{
              io.sockets.in(room).emit("room_change" , {room});
            })
            return await progress(data, Socket, io);
          })
        }
        return
      }
    }
  })
}

export const exitRoom = async (data, Socket, io) => {
  const {room, player} = data;
  let log = `exitRoom==============room: ${room}==player: ${player}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  const { deletedCount } = await roomPlayers.deleteOne({room, player, seated:true});
  if(deletedCount){
    await initRoom(room, player, io);
    progress(data, Socket, io);
  }else{
    const isDeleted = await roomPlayers.deleteOne({room, player});
    if(isDeleted.deletedCount){
      await initRoom(room, player, io);
    }
  }
}

const initRoom = async (room, player, io) => {
  io.sockets.emit("user_change");
  io.sockets.in(room).emit("exitRoom", {room, player});
  await Chat.deleteMany({room});
  const isRoominit = await roomPlayers.findOne({room});
  if(!isRoominit){
    await rooms.updateOne({_id:room}, {finished:false, status:false, see:false});
  }
}

export const disconnect = async (data, Socket, io) => {
  const { nModified } = await roomPlayers.updateOne({socketId:Socket.id}, {socketId:''})
  if(nModified){
    let log = `disconnect==============socketId: ${Socket.id}==============`;
    console.log(log)
    logToFile(log, `${DIR}/src/log/game.log`)
  }
}

const isAllTalked = async (room) =>{
  let isAllTalked = true;
  await roomPlayers.findOne({room, pack:false, seated:true, talked:false}).then(async(players) => {
    if(players){
      return isAllTalked = await false;
    }
  })
  return isAllTalked;
}

const getNextPlayers = async (room) =>{
  return await roomPlayers.find({room, seated: true, pack: false, isClose:false});
}

const setNCurrentPlayer = async (room) => {
  let isSet = false;
  await roomPlayers.find({room, seated:true}).sort({ position:0 }).then(async players => {
    const cIndex = players.findIndex(player => player.currentPlayer == true);
    const players1 = [...players, ...players];
    for(let i = cIndex; i<=players1.length; i++){
      var currentPlayer = players1[i + 1];
      if(!currentPlayer.pack){
        await roomPlayers.updateOne({room, currentPlayer:true}, {currentPlayer:false});
        await roomPlayers.updateOne({room, player:currentPlayer.player},{currentPlayer:true, lastTime:new Date()});
        return isSet = await true;
      }
    }
  })
  return isSet;
}

const gameEnd = async (data, Socket, io) => {
  const {room} = data;
  let log = `gameEnd==============room: ${room}==============\n`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await rooms.findById(room).then(async playerData=>{
    if(playerData){
      await roomPlayers.updateMany({room}, {pot:0, currentPlayer:false});
      await rooms.updateOne({_id:new ObjectId(room)},{allPot:0, finished:true, see:false, status:false}).then(async e=>{
        if(data.player){
          await chipsUpdate(data.player, playerData.allPot);
        }else{
          await roomPlayers.findOne({room}).sort('-score')
          .then(async e=>{
            await chipsUpdate(e.player, playerData.allPot);
          })
        }
      })
    }
  })
  await returnData(data, Socket, io);
}

const blindCountUpdate = async (_id) => {
  await rooms.updateOne({_id}, {$inc:{blindCount:1}}).then(e=>{
    roomPlayers.updateMany({room:_id},{talked:false});
  });
}

const chipsUpdate = async (player, chips) => {
  let updateChips = parseFloat(chips)
  await roomPlayers.updateOne({player}, {$inc:{chips:updateChips}, winner:true});
}

const potUpdate = async (room, player, pot) => {
  let updatePot = parseFloat(pot)
  await roomPlayers.findOne({player}).then(async players =>{
    if(players.chips>=updatePot){
      await roomPlayers.updateOne({player}, {$inc:{pot:updatePot, chips:(updatePot*-1)}});
      await rooms.updateOne({_id:room}, {$inc:{allPot:updatePot}});
    }else{
      updatePot = players.chips;
      await roomPlayers.updateOne({player}, {$inc:{pot:updatePot, chips:(updatePot*-1)}, pack:true});
      await rooms.updateOne({_id:room}, {$inc:{allPot:updatePot}});
    }
  })
}

const channelUpdate = async (_id, channel) => {
  let updateChannel = parseFloat(channel);
  await rooms.updateOne({_id}, {$inc:{channel:updateChannel}});
}

const rankUpdate = async (player, rankData) => {
  await roomPlayers.updateOne({player}, {score:rankData.score, name:rankData.name, desc:rankData.desc});
}

const seeUpdate = async (room, channel) => {
  await roomPlayers.updateMany({room}, {see:true}).then(async e=>{
    await rooms.updateOne({_id:room}, {see:true});
  })
}

const returnData = async(data, Socket, io)=>{
  const {room} = data;
  const { roomTimeout } = await rooms.findById(room);
  io.sockets.in(room).emit("room_change" , {room});
  if (!rooms_timer[room]){
    rooms_timer[room] = setTimeout(()=>{
      initNewRound( data, Socket, io);
    },roomTimeout);
  }
}

const initNewRound = async (data, Socket, io)=>{
  const {room} = data;
  let log = `initNewRound==============room: ${room}==============`;
  console.log(log)
  logToFile(log, `${DIR}/src/log/game.log`)
  await rooms.findOne({_id : room}).then(async (roomData) => {
    await roomPlayers.find({room}).then(async closeUsers => {
      for(let i in closeUsers){
        let player = closeUsers[i].player;
        if(closeUsers[i].isClose){
          await roomPlayers.deleteOne({player});
          io.sockets.in(room).emit("exitRoom", {room, player});
        }else if(closeUsers[i].chips<=roomData.bootAmount*10){
          await roomPlayers.deleteOne({player});
          io.sockets.in(room).emit("exitRoom", {room, player});
        }
      }
      await roomPlayers.find({room}).sort({ position:0 }).then(async(players) => {
        if(players.length >= roomData.minPlayer){
          let dealerIndex = players.findIndex(e => e.dealer === true);
          const players1 = [...players, ...players];
          const dealerID = players1[dealerIndex+1].player;
          
          await roomPlayers.updateMany({room}, {$inc:{pot:roomData.bootAmount, chips:(roomData.bootAmount*-1)}, dealer:false, talked:false, cards:[], score:0, rankName:'', see:false, pack:false, seated:true, winner:false}).then(async() => {
            await roomPlayers.updateOne({room, player:dealerID}, {dealer:true}).then(async() => {
              await rooms.updateOne({_id:room}, {allPot:0,see:false, channel:roomData.bootAmount, blindCount:0, finished:false, status:true}).then(async() => {
                await newRound(room);
                io.sockets.in(room).emit("room_change" , {room});
                rooms_timer[room] = null;
              })
            })
          })
        }else{
          await rooms.updateOne({_id:room}, {allPot:0, blindCount:0, see:false,channel:roomData.bootAmount, finished:false}).then(async() => {
            await roomPlayers.updateMany({room}, {winner:false, dealer:false, pot:0, talked:false, cards:[], score:0, rankName:'', see:false, pack:false, currentPlayer:false, seated:false});
            io.sockets.in(room).emit("room_change" , {room});
            rooms_timer[room] = null;
          })
        }
      })
    })
  })
}

const newRound = async (_id) => {
  await roomPlayers.find({room:_id, seated:true}).sort({ position:0 }).then(async players => {
    var deck = await fillDeck();
    for (var i = 0; i < players.length; i ++) {
      var cards = [];
      cards.push(deck.pop());
      cards.push(deck.pop());
      cards.push(deck.pop());
      await roomPlayers.updateOne({player:players[i].player}, {cards}).then( async () => {
        var dealerIndex = players.findIndex(player => player.dealer == true);
        const players1 = [...players, ...players];
        var currentPlayer = players1[dealerIndex + 1];
        await rooms.findById(_id).exec().then(async(roomData) => {
          await roomPlayers.updateMany({room:_id}, {pot:roomData.bootAmount}).then(async()=>{
            await roomPlayers.updateOne({player:currentPlayer.player}, {currentPlayer:true, lastTime:new Date()}).then(async() => {
              await roomPlayers.updateMany({$nor:[{player:currentPlayer.player}], room:_id}, {currentPlayer:false}).then(async() => {
                await rooms.updateOne({_id}, {allPot:roomData.bootAmount*players.length});
              })
            })
          })
        })
      })
    }
  })
}

const fillDeck = async () => {
  var deck = [
    "AS","KS","QS","JS","TS","9S","8S","7S","6S","5S","4S","3S","2S",
    "AH","KH","QH","JH","TH","9H","8H","7H","6H","5H","4H","3H","2H",
    "AD","KD","QD","JD","TD","9D","8D","7D","6D","5D","4D","3D","2D",
    "AC","KC","QC","JC","TC","9C","8C","7C","6C","5C","4C","3C","2C"
  ];
  var i, j, tempi, tempj;
  for (i = 0; i < deck.length; i += 1) {
    j = Math.floor(Math.random() * (i + 1));
    tempi = deck[i];
    tempj = deck[j];
    deck[i] = tempj;
    deck[j] = tempi;
  }
  return deck;
};

const scoreHandsNormal = async (playerCards) => {
	if (playerCards.length == 3) {
		var clonePlayerCards = _.sortBy(_.map(playerCards, function (n) { return cards.cardValue(n); }), "number");
		var handStatus = {};
		var groupByNumber = _.groupBy(clonePlayerCards, "number");
		var groupByColor = _.groupBy(clonePlayerCards, "color");
		var sameNumberCount = _.keys(groupByNumber).length;
		var sameColorCount = _.keys(groupByColor).length;
		var diff1 = clonePlayerCards[1].number - clonePlayerCards[0].number;
		var diff2 = clonePlayerCards[2].number - clonePlayerCards[1].number;
		var isSequence = (diff1 == diff2 && diff2 == 1) || (clonePlayerCards[0].number == 1 && clonePlayerCards[1].number == 12 && clonePlayerCards[2].number == 13);
		handStatus.no = 0;
		handStatus.name = "High Card";
		if (clonePlayerCards[0].number == 1) {
			handStatus.card1 = 14;
			handStatus.card2 = clonePlayerCards[2].number;
			handStatus.card3 = clonePlayerCards[1].number;
			handStatus.desc = "High Card of A";
		} else {
			handStatus.card1 = clonePlayerCards[2].number;
			handStatus.card2 = clonePlayerCards[1].number;
			handStatus.card3 = clonePlayerCards[0].number;
			handStatus.desc = "High Card of " + cards.keyToString(handStatus.card1);
		}
		if (sameNumberCount == 2) {
			handStatus.name = "Pair";
			handStatus.no = 1;
			for (var i = 0; i < 3; i++) {
				if (playerCards[i].charAt(1) == "s")
					handStatus.no += 0.2;
				else if (playerCards[i].charAt(1) == "h")
					handStatus.no += 0.15;
				else if (playerCards[i].charAt(1) == "d")
					handStatus.no += 0.1;
				else if (playerCards[i].charAt(1) == "c")
					handStatus.no += 0.05;
			}
			_.each(groupByNumber, function (n, key) {
				if (n.length == 2) {
					handStatus.card1 = parseInt(key);
					handStatus.desc = "Pair of " + cards.keyToString(key);
					if (key == "1") {
						handStatus.card1 = 14;
					}
				} else {
					handStatus.card2 = parseInt(key);
					if (key == "1") {
						handStatus.card2 = 14;
					}
				}
			});
			handStatus.card3 = 0;
		}
		if (sameColorCount == 1) {
			handStatus.no = 2;
			for (var i = 0; i < 3; i++) {
				if (playerCards[i].charAt(1) == "s")
					handStatus.no += 0.2;
				else if (playerCards[i].charAt(1) == "h")
					handStatus.no += 0.15;
				else if (playerCards[i].charAt(1) == "d")
					handStatus.no += 0.1;
				else if (playerCards[i].charAt(1) == "c")
					handStatus.no += 0.05;
			}
			handStatus.name = "Color";
			handStatus.desc = "Color of " + cards.keyToString(handStatus.card1) + " High";
		}
		if (isSequence) {
			if (
				clonePlayerCards[0].number == 1 &&
				clonePlayerCards[1].number == 2 &&
				clonePlayerCards[0].number == 1 &&
				clonePlayerCards[2].number == 3
			) {
				handStatus.card1 = 14;
				handStatus.card2 = clonePlayerCards[2].number;
				handStatus.card3 = clonePlayerCards[1].number;
			}
			handStatus.no = 3;
			for (var i = 0; i < 3; i++) {
				if (playerCards[i].charAt(1) == "s")
					handStatus.no += 0.2;
				else if (playerCards[i].charAt(1) == "h")
					handStatus.no += 0.15;
				else if (playerCards[i].charAt(1) == "d")
					handStatus.no += 0.1;
				else if (playerCards[i].charAt(1) == "c")
					handStatus.no += 0.05;
			}
			handStatus.name = "Sequence";
      handStatus.desc = "Sequence of " + cards.keyToString(handStatus.card1) + " High";
    }
		if (sameColorCount == 1 && isSequence) {
			if (playerCards[0].charAt(1) == "s")
				handStatus.no = 4.2;
			else if (playerCards[0].charAt(1) == "h")
				handStatus.no = 4.15;
			else if (playerCards[0].charAt(1) == "d")
				handStatus.no = 4.1;
			else if (playerCards[0].charAt(1) == "c")
				handStatus.no = 4.05;
			handStatus.name = "Pure Sequence";
			handStatus.desc ="Pure Sequence of " + cards.keyToString(handStatus.card1) + " High";
		}
		if (sameNumberCount == 1) {
			handStatus.no = 5;
			for (var i = 0; i < 3; i++) {
				if (playerCards[i].charAt(1) == "s")
					handStatus.no += 0.2;
				else if (playerCards[i].charAt(1) == "h")
					handStatus.no += 0.15;
				else if (playerCards[i].charAt(1) == "d")
					handStatus.no += 0.1;
				else if (playerCards[i].charAt(1) == "c")
					handStatus.no += 0.05;
			}
			handStatus.name = "Trio";
			handStatus.desc = "Trio of " + cards.keyToString(handStatus.card1);
		}
		handStatus.score = handStatus.no * 1000000 + handStatus.card1 * 10000 + handStatus.card2 * 100 + handStatus.card3 * 1;
		return { name: handStatus.name, desc: handStatus.desc, score: handStatus.score };
	} else {
		console.error(new Error("Number of cards in Score Hands Incorrect"));
	}
}