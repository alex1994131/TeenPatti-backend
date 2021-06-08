import mongoose from 'mongoose';
import bcrypt from 'bcrypt-nodejs';
const Schema = mongoose.Schema;
const userSchema = new Schema({
  email          :{ type:String, lowercase:true, unique: true },
  username       :{ type:String, default: '', unique: true },
  name           :{ type:String, default: '' },
  password       :{ type:String, required:true },
  cash           :{ type:Number, default: 2000 },
  chips          :{ type:Number, default: 75000 },
  mobile         :{ type:String, default: '' },
  refer          :{ type:String, default: '' },
  withdraw_limit :{ type:String, default: '' },
  referby_friends:{ type:String, default: '' },
  verify_mobile  :{ type:String, default: 'not_verify' },
  roomPlayer     : { type:Schema.Types.ObjectId, ref:'roomPlayer'},
  status         :{ type:String, default: 'pending', enum:['pending', 'active', 'deactive']},
  resetPassword  :{ token:String, used:Boolean, expires:Date },
},{ 
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

userSchema.pre('save', function (next) {
  const user = this;
  bcrypt.genSalt(10, (err, salt) => {
    if (err) { return next(err); }
    bcrypt.hash(user.password, salt, null, (err, hash) => {
      if (err) { return next(err); }
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function (candidatePassword, callback) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    if (err) { return callback(err); }
    callback(null, isMatch);
  });
};

export default mongoose.model('player', userSchema);