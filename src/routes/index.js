import routerx from 'express-promise-router';
import users from './users';

const router = routerx();
router.use('/users', users);

export default router;