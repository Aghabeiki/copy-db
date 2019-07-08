const inquirer = require('inquirer');
const isMongoDBQueryAcceptable = require('mongodb-language-model').accepts;
const fuzzy = require('fuzzy');
const {migrationFactory} = require('./migrationFactory');
const {listCollections, listDatabases} = require('./utils');


module.exports = async function  () {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    let remoteClient = null;
    let localClient = null;

    let remoteDatabase;
    let localDatabase;

    let remoteCollection;
    let localCollection;

    const {remotePort, localPort}=await inquirer
        .prompt([
            /* Pass your questions in here */
            {
                type: 'input',
                name: 'remotePort',
                message: "what's the source mongo port?",
                default: function () {
                    return '27017';
                }
            },
            {
                type: 'input',
                name: 'localPort',
                message: "what's the target mongo port?",
                default: function () {
                    return '27017';
                }
            }

        ]);
    if (!remotePort, !localPort) {
        throw new Error('Remote port is required.');

    }
    const getDBLists = async () => {
        const remote = await listDatabases(remotePort);
        const local = await listDatabases(localPort);
        remoteClient = remote.client;
        localClient = local.client;
        return {remoteDatabases: remote.databases, localDatabases: local.databases};
    };
    const {remoteDatabases, localDatabases} =await getDBLists();
   const {remoteDatabaseName, localDatabaseName}= await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'remoteDatabaseName',
            message: 'Select the source Database:',
            source: (answers, input) => {
                input = input || '';
                const fuzzyResult = fuzzy.filter(input, remoteDatabases);
                return Promise.resolve(fuzzyResult.map(function (el) {
                    return el.original;
                }));
            }

        },
        {
            type: 'autocomplete',
            name: 'localDatabaseName',
            suggestOnly: true,
            message: 'Select the target Database:',
            source: (answers, input) => {
                if (input) {
                    const fuzzyResult = fuzzy.filter(input, localDatabases);
                    return Promise.resolve(fuzzyResult.map(function (el) {
                        return el.original;
                    }));
                } else {
                    const fuzzyResult = fuzzy.filter(answers.remoteDatabaseName, localDatabases);
                    return Promise.resolve(fuzzyResult.map(function (el) {
                        return el.original;
                    }));

                }
            },
            validate: function (val) {
                return val ? true : 'We need a database name, at least a new one!';
            },

        }
    ]);
    remoteDatabase = remoteClient.db(remoteDatabaseName);
    localDatabase = localClient.db(localDatabaseName);
    const {remoteCollectionsName, localCollectionsName} =await listCollections(remoteDatabase, localDatabase);
    const {remoteCollectionName, localCollectionName}= await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'remoteCollectionName',
            message: 'Select the source collection:',
            source: (answers, input) => {
                input = input || '';
                const fuzzyResult = fuzzy.filter(input, remoteCollectionsName);
                return Promise.resolve(fuzzyResult.map(function (el) {
                    return el.original;
                }));
            }
        },
        {
            type: 'autocomplete',
            name: 'localCollectionName',
            suggestOnly: true,
            message: 'Select the target collection:',
            source: (answers, input) => {
                input = input || '';
                if (input) {
                    const fuzzyResult = fuzzy.filter(input, localCollectionsName);
                    return Promise.resolve(fuzzyResult.map(function (el) {
                        return el.original;
                    }));
                } else {
                    const fuzzyResult = fuzzy.filter(answers.remoteCollectionName, localCollectionsName);
                    return Promise.resolve(fuzzyResult.map(function (el) {
                        return el.original;
                    }));
                }

            },
            validate: function (val) {
                return val ? true : 'We need a collection name, at least a new one!';
            },
        }
    ]);
    remoteCollection = remoteDatabase.collection(remoteCollectionName);
    localCollection = localDatabase.collection(localCollectionName);
    const {transformerFunction, queryFilter}=await  inquirer.prompt([
        {
            type: 'editor',
            name: 'queryFilter',
            message: 'Enter your filter ',
            default: function () {
                return '{}';
            },
            validate: function (val) {
                if (isMongoDBQueryAcceptable(val)) {
                    return true;
                } else {
                    return 'The query filter is wrong!'
                }
            }
        },
        {
            type: 'editor',
            name: 'transformerFunction',
            message: 'Enter your Transformer Function ',
            default: function () {
                return 'function (doc) {\n' +
                    '    delete doc._id;\n' +
                    '    return doc;\n' +
                    '}';
            },
            validate: function (val) {
                const test = `const doc={_id:'1234'};
                    const fn=${val};
                    const res=fn(doc);
                    JSON.parse(JSON.stringify(res));`;
                let res = true;
                try {
                    eval(test);
                } catch (err) {
                    res = false;
                }
                if (res) {
                    return true;
                } else {
                    return 'The transform function is wrong!'
                }
            }
        }
    ]);
        return await migrationFactory({
            queryFilter: JSON.parse(queryFilter),
            remoteCollection,
            localCollection,
            transformerFunction: eval("let fn=function(){ return " + transformerFunction + ";}; fn() ;")
        });


};
