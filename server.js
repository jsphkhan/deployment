/** 
 * Node server
 * Express
*/
require('dotenv').config();
var express = require('express');
var app = express();
var redis = require('redis');
var morgan  = require('morgan');

app.use(morgan('tiny'));

const port = process.env.PORT || 3000;

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

app.get('/', (req, res) => {
    res.send('Hello there!');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

app.get('/users', (req, res) => {
    //read from cache
    redisClient.get('sess:data', (err, data) => {
        if(err) {
            return res.status(500).send('Server error while reading from redis');
        }
        if(data === null) {
            return res.send('Data not from cache');
        }
        return res.send(data); //data from cache
    });
});

app.post('/users', (req, res) => {
    //put data into cache
    redisClient.set('sess:data', 'hello', (err) => {
        if(err) {
            return res.status(500).send('Server error while writing to redis');
        }
        res.send('thanks');
    });
});

app.listen(port, () => {
    console.log(`server listening at ${port}`);
});
