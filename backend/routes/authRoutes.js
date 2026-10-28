const {Router} = require('express');
const authcontroller = require('../controller/authController');
const monitorcontroller = require('../controller/monitorController')
const incidentController = require('../controller/incidentController')
const {requiredAuth} = require("../middleware/authMiddleware")

const routes = Router();

routes.post('/signup' ,authcontroller.signup_post);
routes.post('/login' ,authcontroller.login_post);
routes.post('/logout' ,authcontroller.logout_post);
routes.get('/me' , requiredAuth , authcontroller.me_get);



routes.post('/monitor' , requiredAuth , monitorcontroller.createMonitor);
routes.get('/monitor' ,requiredAuth, monitorcontroller.getMonitors);


routes.get('/monitors/:id' , requiredAuth , monitorcontroller.getMonitorById)
routes.patch('/monitors/:id' , requiredAuth , monitorcontroller.updateMonitor)
routes.delete('/monitors/:id' , requiredAuth , monitorcontroller.deleteMonitor)


routes.get('/monitors/:id/history' , requiredAuth , monitorcontroller.getMonitorHistory)

routes.get('/incidents' , requiredAuth , incidentController.getIncidents)


module.exports = routes;