const path = require('path');
const express = require('express') ;
const morgan = require('morgan'); // used for logging
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp'); // http parameter pollution
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const bookingController = require('./controllers/bookingController');
const viewRouter = require('./routes/viewRoutes');

const app = express();

app.enable('trust proxy');

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// Enable CORS for all websites
app.use(cors());
// Access-Control-Allow-Origin *
// let's say if our backend is at api.natours.com and front-end at natours.com
// app.use(cors({
//     origin: 'https://www.natours.com'
// })); // ---> these works for simple(get and post) requests only but not for put and patch request
// what is pre-flight phase?

app.options('*', cors());
// app.options('/api/v1/tours/:id', cors()); // only allow tours to be deleted or updated

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));



// Custom middleware to handle preflight requests
app.options('*', cors());

// set security HTTP headers
// app.use(helmet());
app.use(
    helmet({
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: {
            allowOrigins: ['*']
        },
        contentSecurityPolicy:  {
            directives: {
                defaultSrc: ['*'], // allow all the remote javascript
                scriptSrc: ["* data: 'unsafe-eval' 'unsafe-inline' blob:"]
            }
            // directives: {
            //     defaultSrc: ["'self'", 'data:', 'blob:', 'https:', 'ws:'],
            //     baseUri: ["'self'"],
            //     fontSrc: ["'self'", 'https:', 'data:'],
            //     scriptSrc: [
            //       "'self'",
            //       'https:',
            //       'http:',
            //       'blob:',
            //       'https://*.mapbox.com',
            //       'https://js.stripe.com',
            //       'https://m.stripe.network',
            //       'https://*.cloudflare.com',
            //     ],
            //     frameSrc: ["'self'", 'https://js.stripe.com'],
            //     objectSrc: ["'none'"],
            //     styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
            //     workerSrc: [
            //       "'self'",
            //       'data:',
            //       'blob:',
            //       'https://*.tiles.mapbox.com',
            //       'https://api.mapbox.com',
            //       'https://events.mapbox.com',
            //       'https://m.stripe.network',
            //     ],
            //     childSrc: ["'self'", 'blob:'],
            //     imgSrc: ["'self'", 'data:', 'blob:'],
            //     formAction: ["'self'"],
            //     connectSrc: [
            //       "'self'",
            //       "'unsafe-inline'",
            //       'data:',
            //       'blob:',
            //       'https://*.stripe.com',
            //       'https://*.mapbox.com',
            //       'https://*.cloudflare.com/',
            //       'https://bundle.js:*',
            //       'ws://127.0.0.1:*/',
            //         
            //     ],
            //     upgradeInsecureRequests: [],
            // }
        }
    })
);

// Development logging
// console.log(process.env.NODE_ENV);
if(process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter); // this limiter will be applied to all urls startin from /api route

app.post('/webhook-checkout', express.raw({ type: 'application/json' }), bookingController.webhookCheckout);
// this will ensure the body is parsed in raw format but not in json, o.w. the route won't work

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // only accept body less than 10 kb 
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
// as of now if we know any password we can log into the app
// with {"email": { "$gt": ""}} to prevent --->
app.use(mongoSanitize()); // it works by removing $ signs, read documentation

// Data sanitization against XSS
app.use(xss()); // prevents from html malicious code inserted with javascript

// Prevent parameter pollution
app.use(hpp({
    whitelist: [
        'duration',
        'ratingsAverage',
        'ratingsQuantity',
        'maxGroupSize',
        'difficulty',
        'price'
    ]
})
);

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

// will compress all the text response sent to the clients
app.use(compression());

// Test middleware
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    // console.log(req.headers); // log http header
    // console.log(req.cookies);
    next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter); // this is called mounting the router  (middleware...)
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// Handling unhandled routes
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

// 4) START SERVER
module.exports = app;
