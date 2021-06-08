import mongoose from 'mongoose';
import bcrypt from 'bcrypt-nodejs';
const Schema = mongoose.Schema;
const userSchema = new Schema({
  name:             { type :String, default:'' },
  email:            { type :String, lowercase: true, unique: true },
  chips:            { type :Number, default:0 },
  cash:             { type :Number, default:0 },
  email_verified_at:{ type :Date  , default: Date.now },
  password:         { type :String, required: true },
  remember_token:   { type :String, default:'' },
  status:           { type :String, default: 'accepted',enum: ['pending', 'accepted', 'denied']},
  resetPassword:    { token:String, used: Boolean, expires: Date, },
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

userSchema.pre('findOne', async function(next) {
  this.populate('role');
  next();
})

userSchema.methods.comparePassword = function (candidatePassword, callback) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    if (err) { return callback(err); }
    callback(null, isMatch);
  });
};


export default mongoose.model('user', userSchema);