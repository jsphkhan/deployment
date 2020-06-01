/** 
 * Node server
 * Express
*/
require('dotenv').config();
var express = require('express');
var app = express();
var redis = require('redis');
var morgan  = require('morgan');
var mongoose = require('mongoose');

app.use(morgan('tiny'));

const port = process.env.PORT || 3000;

//Mongo Schema - just for example
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: true
    }
});
//define the collection/table name
UserSchema.set('collection', 'users');

//define Model
const UsersModel = mongoose.model('UsersModel', UserSchema);

//connect to redis
//REDIS_HOST env var comes from docker-compose.yml
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const redisClient = redis.createClient({
    host: REDIS_HOST,  //docker container name. see docker-compose.yml
    port: 6379
});
redisClient.on('error', (err) => {
    console.log('Redis Con Error');
    console.log(err);
    process.exit();
});

//connect to mongodb
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/testdatabase';
mongoose.connect(MONGO_URL, {
    useNewUrlParser: true, 
    useCreateIndex: true, 
    useUnifiedTopology: true,
    // reconnectTries: Number.MAX_VALUE,
    // reconnectInterval: 500, 
    // connectTimeoutMS: 10000,
});
mongoose.connection.on('error', () => {
    console.log('Mongo Con Error');
    console.log(err);
    redisClient.end(true);
    process.exit();
});

app.get('/', (req, res) => {
    res.send('Hello there!');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

const checkCacheMiddleware = (req, res, next) => {
    redisClient.get('data:users', (err, users) => {
        if(err) {
            return res.status(500).send('Server error while reading from redis');
        }
        if(users === null) {
            return next();
        }
        console.log('*** From Cache ***');
        return res.status(200).json(JSON.parse(users));
    })
}

//get all users
app.get('/users', checkCacheMiddleware, (req, res) => {
    //read from mongo and set to cache
    UsersModel.find({}).lean().exec((err, users) => {
        if(err) {
            return res.status(500).send('Server Error');
        }

        //set data into redis cache
        redisClient.set('data:users', JSON.stringify(users), (err) => {
            if(err) {
                return res.status(500).send('Server error while writing to redis');
            }
            
            console.log('*** from DB ***');
            res.status(200).json(users);
        });
    });
});

//create a new user
app.post('/users', (req, res) => {
    //create a new user
    const user = new UsersModel({
        name: `Joseph ${Math.random()}`,
        email: `kljlkjl${Math.random()}@gmail.com`
    });

    user.save((err, newUser) => {
        if(err) {
            return res.status(500).send('Server error while writing to mongo');
        }

        //clear redis cache - this is just for test
        redisClient.del('data:users', (err, status) => {
            //console.log('Status: ', status);
            if(err) {
                return res.status(500).send('Server error while deleting from redis');
            }

            res.status(201).json(newUser);
        });
    })
});

app.listen(port, () => {
    console.log(`server listening at ${port}`);
});
