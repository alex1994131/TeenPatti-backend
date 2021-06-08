import routerx from 'express-promise-router';
import auth from '../middlewares/auth';
import usersController from '../controllers/usersController';
const router=routerx();

router.post('/login',usersController.login);
router.post('/register',usersController.register);
router.get('/',auth.verifyToken,usersController.getPlayer);
router.post('/',auth.verifyToken,usersController.GetTotalUsers);

export default router;