import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const userSchema = new Schema({
  roomName     : { type:String , default: '' },
  roomType     : { type:String , default: '' },
  bootAmount   : { type:Number , default: 0  },
  maxBlind     : { type:Number , default: 0  },
  maxPot       : { type:Number , default: 0  },
  minPlayer    : { type:Number , default: 2  },
  maxPlayer    : { type:Number , default: 0  },
  channel      : { type:Number , default: 0  },
  allPot       : { type:Number , default: 0  },
  blindCount   : { type:Number , default: 0  },
  userFTimeout : { type:Number , default: 20000  },
  userETimeout : { type:Number , default: 10000  },
  roomTimeout  : { type:Number , default: 10000  },
  finished     : { type:Boolean, default:false},
  see          : { type:Boolean, default:false},
  status       : { type:Boolean, default:false},
},{ 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});
userSchema.pre('save', function (next) {
  const room = this;
  room.maxPot = room.maxBlind * room.bootAmount * 10;
  room.channel = room.bootAmount;
  next();
});
let model = mongoose.model('room', userSchema);;
export default model