import mongoose from 'mongoose';
const Schema = mongoose.Schema;
const userSchema = new Schema({
  name:        { type:String, default:'' },
  content:     { type:String, default:'' },
  room:        { type:Schema.Types.ObjectId, ref:'room'},
  player:      { type:Schema.Types.ObjectId, ref:'player'},
},{ 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } 
});
export default mongoose.model('chat', userSchema);