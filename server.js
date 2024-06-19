const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env'});

process.on('uncaughtException', err => {
    console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    process.exit(1); // closing is compulsory here as our code is not clean now
});

const app = require('./app');


const DB = process.env.DATABASE?.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.set('strictQuery', true); // inorder to suppress warnings

mongoose.connect(DB).then( con => {
    // console.log(con.connections);
    console.log('DB connection successful!');
}); // handling the promise returned by mongoose.connect()

// connecting to local database
// mongoose.connect(process.env.DATABASE_LOCAL).then( () => console.log('Local DB connection successful!'));

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
    console.log(err.name, err.message);
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    server.close(() => {
        process.exit(1); // closing application gracefully // optional
    });
});

// console.log(x);
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    // SIGTERM signal asks server to close gracefully
    server.close(() => {
        console.log('💥 Process terminated!');
    });
});