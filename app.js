#!/usr/bin/env node

const migrateIT = require('./main');

process.on('uncaughtException', err => {
    console.debug(err);
});
process.on('unhandledRejection', err => {
    console.debug(err)
});


// todo check this part for different OS or check is it
process.env.EDITOR = 'nano';


migrateIT()
    .then(_ => {
        process.exit(0)
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
