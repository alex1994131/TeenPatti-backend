export default {
    verifyToken: async (req,res,next) => {
        if (!req.headers.authtoken){
            return res.status(404).send({
                message: 'No token.'
            });
        }
        req.context.models.Users.findOne({
            where: { authToken: req.headers.authtoken },
        }).then(seller => {
            if(seller) {
                return next();
            } else {
                return res.status(403).send({message: 'Not authorized.'});
            }
        });
    },
}