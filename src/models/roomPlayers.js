import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const userSchema = new Schema({
  name          : { type:String , default:''    },
  desc          : { type:String , default:''    },
  cards         : { type:Array  , default:[]    },
  score         : { type:Number , default:0     },
  pot           : { type:Number , default:0     },
  chips         : { type:Number , default:0     },
  position      : { type:Number , default:0     },
  see           : { type:Boolean, default:false },
  pack          : { type:Boolean, default:false },
  dealer        : { type:Boolean, default:false },
  seated        : { type:Boolean, default:false },
  currentPlayer : { type:Boolean, default:false },
  talked        : { type:Boolean, default:false },
  winner        : { type:Boolean, default:false },
  isClose       : { type:Boolean, default:false },
  socketId      : { type:String,  default:''    },
  lastTime      : { type:Date,  default:Date.now},
  room          : { type:Schema.Types.ObjectId, ref:'room'},
  player        : { type:Schema.Types.ObjectId, ref:'player'}, 
},{ 
  timestamps    : {  createdAt: 'createdAt', updatedAt: 'updatedAt' }
});
export default mongoose.model('roomPlayer', userSchema);